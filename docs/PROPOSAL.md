# NightBid: Product Proposal

**Program:** Rise In × Midnight: *New Moon to Full*, Level 3 (First Quarter)
**Chosen idea:** 🔨 **Sealed-Bid Auction** (private bids, verifiable winner)
**Builder:** @mishaldotrs

## Problem

Freelance marketplaces run open bidding, where every bid is visible. This causes three problems:

1. **Undercutting.** Late bidders post $1 below the lowest visible bid, which drives rates down and punishes the freelancers who bid honestly first.
2. **Rate leakage.** Competitors and clients learn each freelancer's pricing, and that follows them to future gigs.
3. **Trust in the platform.** "Sealed" bids on Web2 platforms only mean sealed from other users. The platform can still see, and could leak or manipulate, every bid.

On public blockchains (Ethereum, Stellar, and others) the problem is worse: every bid is permanently public.

## Solution

**NightBid** is a reverse (lowest-price-wins) sealed-bid auction for gig work, built on Midnight:

- **Clients** post a gig with a public title and maximum budget.
- **Freelancers** place bids that are **sealed on-chain** as hash commitments. A zero-knowledge proof guarantees each hidden bid is valid (`0 < bid ≤ budget`) and bound to the bidder's secret identity.
- When the client closes bidding, bidders **prove** their bid to claim the win. The contract verifies each claim against the sealed commitment, and the lowest verified claim leads.
- The client awards the gig. **Losing bids are never revealed, to anyone, ever.**

This evolves my Stellar project **GigVault** (freelance milestone escrow), rebuilt privacy-first on Midnight.

## Why Midnight

The problem needs **private inputs with public verifiability**, which is exactly what Compact circuits provide:

- `disclose()` makes every public field an explicit design decision. The compiler blocks accidental leaks.
- Witnesses keep the user's secret key and bid amounts local, and only proofs reach the chain.
- No trusted auctioneer is needed: the ZK circuit is the auctioneer.

## Target users

- Freelancers who want fair competition without being undercut.
- Clients (startups, DAOs) who want honest price discovery and less collusion.
- DAOs and grant programs running procurement or RFPs.

## Scope

| Level | Deliverable |
|---|---|
| **L3 (this)** | Compact contract (6 circuits), sealed bids with ZK budget proof, reveal and award flow, Lace integration, observer view, 15 tests, CI/CD |
| L4 | Shielded tDUST escrow on award, bid deposits (no-show penalty), bid-opening backup/export, docs site, X profile |
| L5 | 50 Preprod users: onboarding flow, feedback widget, analytics on bid counts |
| L6 | Mainnet deploy, dispute resolution, reputation (ported from GigVault), 20 real users |

## Success metrics

- Every bid is sealed: 0 bid amounts appear on-chain until a voluntary claim, verified in the observer view and in tests.
- End-to-end auction (post → seal → reveal → award) completes on Preprod in under 5 minutes.
- Level 5: 50 unique Preprod wallets placing at least 1 sealed bid.
