import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/nightbid/contract/index.js';

/**
 * NightBid's wallet-local private state.
 *
 * The secret key never leaves the user's machine: circuits use it (via the
 * `localSecretKey` witness) to derive an unlinkable NightBid identity and to
 * bind sealed-bid commitments to their owner, but only hashes of it are ever
 * disclosed to the public ledger.
 */
export type NightBidPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createNightBidPrivateState = (
  secretKey: Uint8Array,
): NightBidPrivateState => ({ secretKey });

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, NightBidPrivateState>): [
    NightBidPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
