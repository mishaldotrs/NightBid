/** Circuits that produce ZK proofs (and so need prover/verifier keys). */
export const NIGHTBID_CIRCUITS = [
  'createGig',
  'placeBid',
  'closeBidding',
  'claimWin',
  'awardGig',
  'cancelGig',
] as const;

export type NightBidCircuitId = (typeof NIGHTBID_CIRCUITS)[number];

export const PRIVATE_STATE_ID = 'nightbidPrivateState';

/** Network Lace should connect to. Level 2+ targets Midnight Preprod. */
export const NETWORK_ID: string = import.meta.env.VITE_NETWORK_ID ?? 'preprod';

/** Optional pre-deployed NightBid market; users can also deploy/join from the UI. */
export const DEFAULT_CONTRACT_ADDRESS: string | undefined =
  import.meta.env.VITE_CONTRACT_ADDRESS || undefined;

/** Where the compiled ZK artifacts (keys/, zkir/) are served from. */
export const zkArtifactsBaseUrl = (): string =>
  new URL('nightbid', window.location.origin + import.meta.env.BASE_URL).href;
