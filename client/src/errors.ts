const KNOWN_ERRORS: [RegExp, string][] = [
  [/rejected|PermissionRejected|denied|declined/i, 'You rejected the request in your wallet.'],
  [/not (yet )?synced|still syncing|sync(ing)? in progress/i, 'Lace is still syncing your Midnight wallet. Wait until it shows "Synced", then try again.'],
  [/bid exceeds budget/, 'Your bid is above the gig budget.'],
  [/bid must be positive/, 'Bids must be greater than zero.'],
  [/client cannot bid on own gig/, "You can't bid on your own gig."],
  [/bidding is not open/, 'Bidding is closed for this gig.'],
  [/only the client/, 'Only the client who posted this gig can do that.'],
  [/no matching sealed bid/, "Your reveal doesn't match your sealed bid."],
  [/a lower claim already leads/, 'A lower bid has already been revealed — you were outbid.'],
  [/no verified claims/, 'No bidder has revealed a winning bid yet.'],
  [/insufficient|\bdust\b/i, 'Not enough tDUST to pay fees. Top up from the faucet.'],
];

/** Turns wallet/contract failures into short, human messages. */
export const friendlyError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  return KNOWN_ERRORS.find(([pattern]) => pattern.test(raw))?.[1] ?? raw;
};
