import { randomBytes } from 'node:crypto';
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
  type CircuitResults,
  type ChargedState,
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
  private state!: ChargedState;

  private constructor() {}

  static async deploy(): Promise<NightBidSimulator> {
    const simulator = new NightBidSimulator();
    const deployerState = simulator.privateStateFor('deployer');
    const { currentContractState } = simulator.contract.initialState(
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
    return ledger(this.state);
  }

  getGig(gigId: bigint): Gig {
    return this.getLedger().gigs.lookup(gigId);
  }

  /**
   * Runs a circuit as `user` against the current ledger. Async so callers
   * treat it like a real (proved + submitted) transaction.
   */
  private async call<R>(
    user: string,
    invoke: (context: CircuitContext<NightBidPrivateState>) => CircuitResults<NightBidPrivateState, R>,
  ): Promise<R> {
    const context = createCircuitContext(
      this.contractAddress,
      COIN_PUBLIC_KEY,
      this.state,
      this.privateStateFor(user),
    );
    const results = invoke(context);
    this.state = results.context.currentQueryContext.state;
    return results.result;
  }

  createGig(user: string, title: string, budget: bigint): Promise<bigint> {
    return this.call(user, (ctx) =>
      this.contract.impureCircuits.createGig(ctx, title, budget),
    );
  }

  placeBid(
    user: string,
    gigId: bigint,
    amount: bigint,
    nonce: Uint8Array,
  ): Promise<[]> {
    return this.call(user, (ctx) =>
      this.contract.impureCircuits.placeBid(ctx, gigId, amount, nonce),
    );
  }

  closeBidding(user: string, gigId: bigint): Promise<[]> {
    return this.call(user, (ctx) =>
      this.contract.impureCircuits.closeBidding(ctx, gigId),
    );
  }

  claimWin(
    user: string,
    gigId: bigint,
    amount: bigint,
    nonce: Uint8Array,
  ): Promise<[]> {
    return this.call(user, (ctx) =>
      this.contract.impureCircuits.claimWin(ctx, gigId, amount, nonce),
    );
  }

  awardGig(user: string, gigId: bigint): Promise<[]> {
    return this.call(user, (ctx) =>
      this.contract.impureCircuits.awardGig(ctx, gigId),
    );
  }

  cancelGig(user: string, gigId: bigint): Promise<[]> {
    return this.call(user, (ctx) =>
      this.contract.impureCircuits.cancelGig(ctx, gigId),
    );
  }
}
