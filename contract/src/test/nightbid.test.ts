import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { GigStatus } from '../managed/nightbid/contract/index.js';
import { NightBidSimulator } from './nightbid-simulator.js';

const nonce = (): Uint8Array => randomBytes(32);

describe('NightBid sealed-bid gig auctions', () => {
  let sim: NightBidSimulator;

  beforeEach(async () => {
    sim = await NightBidSimulator.deploy();
  });

  it('lets a client post a public gig that opens for bidding', async () => {
    const gigId = await sim.createGig('client', 'Build a landing page', 1000n);

    expect(gigId).toBe(0n);
    const gig = sim.getGig(gigId);
    expect(gig.title).toBe('Build a landing page');
    expect(gig.budget).toBe(1000n);
    expect(gig.status).toBe(GigStatus.open);
    expect(gig.bidCount).toBe(0n);
    expect(gig.client).toEqual(sim.publicKeyOf('client'));
    expect(sim.getLedger().nextGigId).toBe(1n);
  });

  it('seals a bid: the ledger records a commitment, never the amount or bidder', async () => {
    const gigId = await sim.createGig('client', 'Design a logo', 500n);

    await sim.placeBid('freelancer', gigId, 320n, nonce());

    const observerView = sim.getLedger();
    const gig = observerView.gigs.lookup(gigId);
    // An observer can see THAT someone bid...
    expect(gig.bidCount).toBe(1n);
    expect(observerView.sealedBids.size()).toBe(1n);
    // ...but the sealed commitment is 32 opaque bytes: no amount, no identity.
    const [commitment] = [...observerView.sealedBids];
    expect(commitment).toHaveLength(32);
    expect(gig.hasWinner).toBe(false);
    expect(gig.winningBid).toBe(0n);
    expect(gig.winner).toEqual(new Uint8Array(32));
  });

  it('proves in zero knowledge that a sealed bid is within budget', async () => {
    const gigId = await sim.createGig('client', 'Write API docs', 500n);

    await expect(
      sim.placeBid('freelancer', gigId, 501n, nonce()),
    ).rejects.toThrow(/bid exceeds budget/);
    await expect(
      sim.placeBid('freelancer', gigId, 0n, nonce()),
    ).rejects.toThrow(/bid must be positive/);
  });

  it('stops a client from bidding on their own gig', async () => {
    const gigId = await sim.createGig('client', 'Audit my contract', 900n);

    await expect(sim.placeBid('client', gigId, 100n, nonce())).rejects.toThrow(
      /client cannot bid on own gig/,
    );
  });

  it('only lets the gig client close bidding, and blocks late bids', async () => {
    const gigId = await sim.createGig('client', 'Ship a mobile app', 2000n);
    await sim.placeBid('freelancer', gigId, 1500n, nonce());

    await expect(sim.closeBidding('stranger', gigId)).rejects.toThrow(
      /only the client can close bidding/,
    );

    await sim.closeBidding('client', gigId);
    expect(sim.getGig(gigId).status).toBe(GigStatus.bidding_closed);

    await expect(
      sim.placeBid('latecomer', gigId, 100n, nonce()),
    ).rejects.toThrow(/bidding is not open/);
  });

  it('rejects a win claim that does not match a sealed commitment', async () => {
    const gigId = await sim.createGig('client', 'Fix a bug', 400n);
    const aliceNonce = nonce();
    await sim.placeBid('alice', gigId, 300n, aliceNonce);
    await sim.closeBidding('client', gigId);

    // Alice lies about her amount: proof cannot match her commitment.
    await expect(
      sim.claimWin('alice', gigId, 250n, aliceNonce),
    ).rejects.toThrow(/no matching sealed bid/);
    // Bob never bid at all.
    await expect(sim.claimWin('bob', gigId, 100n, nonce())).rejects.toThrow(
      /no matching sealed bid/,
    );
  });

  it('lets the lowest verified claim take the lead, and rejects higher claims', async () => {
    const gigId = await sim.createGig('client', 'Build a dashboard', 1000n);
    const aliceNonce = nonce();
    const bobNonce = nonce();
    await sim.placeBid('alice', gigId, 800n, aliceNonce);
    await sim.placeBid('bob', gigId, 500n, bobNonce);
    await sim.closeBidding('client', gigId);

    await sim.claimWin('alice', gigId, 800n, aliceNonce);
    expect(sim.getGig(gigId).winningBid).toBe(800n);
    expect(sim.getGig(gigId).winner).toEqual(sim.publicKeyOf('alice'));

    await sim.claimWin('bob', gigId, 500n, bobNonce);
    expect(sim.getGig(gigId).winningBid).toBe(500n);
    expect(sim.getGig(gigId).winner).toEqual(sim.publicKeyOf('bob'));

    // Alice cannot reclaim with her higher bid.
    await expect(
      sim.claimWin('alice', gigId, 800n, aliceNonce),
    ).rejects.toThrow(/a lower claim already leads/);
  });

  it('runs the full happy path and keeps the losing bid sealed forever', async () => {
    const gigId = await sim.createGig('client', 'Launch NightBid', 1000n);
    const winnerNonce = nonce();
    await sim.placeBid('winner', gigId, 600n, winnerNonce);
    await sim.placeBid('loser', gigId, 950n, nonce());
    await sim.closeBidding('client', gigId);
    await sim.claimWin('winner', gigId, 600n, winnerNonce);

    await expect(sim.awardGig('stranger', gigId)).rejects.toThrow(
      /only the client can award/,
    );
    await sim.awardGig('client', gigId);

    const gig = sim.getGig(gigId);
    expect(gig.status).toBe(GigStatus.awarded);
    expect(gig.winner).toEqual(sim.publicKeyOf('winner'));
    expect(gig.winningBid).toBe(600n);
    // The loser's 950 bid was never revealed: the ledger still holds only
    // two opaque commitments and the single claimed amount.
    expect(sim.getLedger().sealedBids.size()).toBe(2n);
  });

  it('lets a client cancel an open gig, but not after bidding closes', async () => {
    const first = await sim.createGig('client', 'Cancel me', 100n);
    await expect(sim.cancelGig('stranger', first)).rejects.toThrow(
      /only the client can cancel/,
    );
    await sim.cancelGig('client', first);
    expect(sim.getGig(first).status).toBe(GigStatus.cancelled);
    await expect(
      sim.placeBid('freelancer', first, 50n, nonce()),
    ).rejects.toThrow(/bidding is not open/);

    const second = await sim.createGig('client', 'Too late to cancel', 100n);
    await sim.closeBidding('client', second);
    await expect(sim.cancelGig('client', second)).rejects.toThrow(
      /only open gigs can be cancelled/,
    );
  });
});
