import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum GigStatus { open = 0, bidding_closed = 1, awarded = 2, cancelled = 3
}

export type Gig = { id: bigint;
                    client: Uint8Array;
                    title: string;
                    budget: bigint;
                    status: GigStatus;
                    bidCount: bigint;
                    hasWinner: boolean;
                    winningBid: bigint;
                    winner: Uint8Array
                  };

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createGig(context: __compactRuntime.CircuitContext<PS>,
            title_0: string,
            budget_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  placeBid(context: __compactRuntime.CircuitContext<PS>,
           gigId_0: bigint,
           amount_0: bigint,
           nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeBidding(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  claimWin(context: __compactRuntime.CircuitContext<PS>,
           gigId_0: bigint,
           amount_0: bigint,
           nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  awardGig(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancelGig(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  createGig(context: __compactRuntime.CircuitContext<PS>,
            title_0: string,
            budget_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  placeBid(context: __compactRuntime.CircuitContext<PS>,
           gigId_0: bigint,
           amount_0: bigint,
           nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeBidding(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  claimWin(context: __compactRuntime.CircuitContext<PS>,
           gigId_0: bigint,
           amount_0: bigint,
           nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  awardGig(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancelGig(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  derivePublicKey(sk_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  derivePublicKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  createGig(context: __compactRuntime.CircuitContext<PS>,
            title_0: string,
            budget_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  placeBid(context: __compactRuntime.CircuitContext<PS>,
           gigId_0: bigint,
           amount_0: bigint,
           nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeBidding(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  claimWin(context: __compactRuntime.CircuitContext<PS>,
           gigId_0: bigint,
           amount_0: bigint,
           nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  awardGig(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancelGig(context: __compactRuntime.CircuitContext<PS>, gigId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  gigs: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Gig;
    [Symbol.iterator](): Iterator<[bigint, Gig]>
  };
  readonly nextGigId: bigint;
  sealedBids: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
