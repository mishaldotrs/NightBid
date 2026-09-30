import { randomBytes } from 'node:crypto';
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ledger,
  pureCircuits,
  type Gig,
  type Ledger,
} from '../managed/nightbid/contract/index.js';
import {
  createNightBidPrivateState,
  witnesses,
  type NightBidPrivateState,
} from '../witnesses.js';

const COIN_PUBLIC_KEY = { bytes: new Uint8Array(32) };

/**
 * An in-memory, multi-user simulation of the NightBid contract, mirroring
 * how the deployed contract executes on Midnight: a shared public ledger,
 * plus a wallet-local private state (secret key) per user.
 */
export class NightBidSimulator {
  private readonly contract = new Contract<NightBidPrivateState>(witnesses);
  private readonly contractAddress = sampleContractAddress();
  private readonly users = new Map<string, NightBidPrivateState>();
  private state: unknown;

  private constructor() {}

  static async deploy(): Promise<NightBidSimulator> {
    const simulator = new NightBidSimulator();
    const deployerState = simulator.privateStateFor('deployer');
    const { currentContractState } = await simulator.contract.initialState(
      createConstructorContext(deployerState, COIN_PUBLIC_KEY),
    );
    simulator.state = currentContractState.data;
    return simulator;
  }

  /** Lazily creates a user (a fresh secret key) on first use. */
  privateStateFor(user: string): NightBidPrivateState {
    let privateState = this.users.get(user);
    if (privateState === undefined) {
      privateState = createNightBidPrivateState(randomBytes(32));
      this.users.set(user, privateState);
    }
    return privateState;
  }

  /** The user's public NightBid identity, as the contract derives it. */
  publicKeyOf(user: string): Uint8Array {
    return pureCircuits.derivePublicKey(this.privateStateFor(user).secretKey);
  }

  /** Read the current public ledger state — everything an observer sees. */
  getLedger(): Ledger {
    return ledger(this.state as never);
  }

  getGig(gigId: bigint): Gig {
    return this.getLedger().gigs.lookup(gigId);
  }

  private async call<R>(
    user: string,
    circuitId: string,
    invoke: (context: never) => Promise<{
      result: R;
      context: { callContext: { currentQueryContext: { state: unknown } } };
    }>,
  ): Promise<R> {
    const context = createCircuitContext({
      circuitId,
      contractAddress: this.contractAddress,
      coinPublicKeyOrZswapState: COIN_PUBLIC_KEY,
      contractState: this.state as never,
      privateState: this.privateStateFor(user),
    });
    const results = await invoke(context as never);
    this.state = results.context.callContext.currentQueryContext.state;
    return results.result;
  }

  createGig(user: string, title: string, budget: bigint): Promise<bigint> {
    return this.call(user, 'createGig', (ctx) =>
      this.contract.impureCircuits.createGig(ctx, title, budget),
    );
  }

  placeBid(
    user: string,
    gigId: bigint,
    amount: bigint,
    nonce: Uint8Array,
  ): Promise<[]> {
    return this.call(user, 'placeBid', (ctx) =>
      this.contract.impureCircuits.placeBid(ctx, gigId, amount, nonce),
    );
  }

  closeBidding(user: string, gigId: bigint): Promise<[]> {
    return this.call(user, 'closeBidding', (ctx) =>
      this.contract.impureCircuits.closeBidding(ctx, gigId),
    );
  }

  claimWin(
    user: string,
    gigId: bigint,
    amount: bigint,
    nonce: Uint8Array,
  ): Promise<[]> {
    return this.call(user, 'claimWin', (ctx) =>
      this.contract.impureCircuits.claimWin(ctx, gigId, amount, nonce),
    );
  }

  awardGig(user: string, gigId: bigint): Promise<[]> {
    return this.call(user, 'awardGig', (ctx) =>
      this.contract.impureCircuits.awardGig(ctx, gigId),
    );
  }

  cancelGig(user: string, gigId: bigint): Promise<[]> {
    return this.call(user, 'cancelGig', (ctx) =>
      this.contract.impureCircuits.cancelGig(ctx, gigId),
    );
  }
}
