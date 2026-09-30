// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { friendlyError } from './errors';
import { bidVault, freshNonce } from './midnight/bid-vault';

const MARKET = 'market-address';
const ALICE = 'alice-shielded-address';

describe('bid vault (browser-only sealed-bid openings)', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a sealed bid opening, including bigint amount and nonce bytes', () => {
    const nonce = freshNonce();
    bidVault.save(MARKET, ALICE, { gigId: 7n, amount: 420n, nonce, placedAt: 1 });

    const [stored] = bidVault.list(MARKET, ALICE);
    expect(stored.gigId).toBe(7n);
    expect(stored.amount).toBe(420n);
    expect(stored.nonce).toEqual(nonce);
  });

  it('scopes openings per market and per wallet account', () => {
    bidVault.save(MARKET, ALICE, { gigId: 1n, amount: 10n, nonce: freshNonce(), placedAt: 1 });

    expect(bidVault.list(MARKET, 'bob')).toEqual([]);
    expect(bidVault.list('other-market', ALICE)).toEqual([]);
    expect(bidVault.list(MARKET, ALICE)).toHaveLength(1);
  });

  it('keeps one opening per gig and survives corrupted storage', () => {
    bidVault.save(MARKET, ALICE, { gigId: 1n, amount: 10n, nonce: freshNonce(), placedAt: 1 });
    bidVault.save(MARKET, ALICE, { gigId: 1n, amount: 9n, nonce: freshNonce(), placedAt: 2 });
    expect(bidVault.list(MARKET, ALICE).map((b) => b.amount)).toEqual([9n]);

    localStorage.setItem(`nightbid:bids:${MARKET}:${ALICE}`, '{not json');
    expect(bidVault.list(MARKET, ALICE)).toEqual([]);
  });

  it('generates unique 32-byte nonces', () => {
    const a = freshNonce();
    expect(a).toHaveLength(32);
    expect(a).not.toEqual(freshNonce());
  });
});

describe('friendlyError', () => {
  it('translates contract assertion failures into plain language', () => {
    expect(friendlyError(new Error('failed assert: bid exceeds budget'))).toBe(
      'Your bid is above the gig budget.',
    );
    expect(friendlyError(new Error('failed assert: a lower claim already leads'))).toMatch(/outbid/);
    expect(friendlyError('User Rejected the transaction')).toMatch(/rejected/);
    expect(friendlyError(new Error('Transaction denied by user'))).toMatch(/rejected/);
    expect(friendlyError(new Error('Wallet is not synced'))).toMatch(/still syncing/);
  });

  it('passes unknown errors through unchanged', () => {
    expect(friendlyError(new Error('indexer timeout'))).toBe('indexer timeout');
  });
});
