import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CONTRACT_ADDRESS } from './midnight/config';
import { NightBidMarket, type PublicMarketState } from './midnight/nightbid-api';
import { connectWallet, detectWallets, type WalletSession } from './midnight/providers';

export type TxStatus =
  | { kind: 'idle' }
  | { kind: 'pending'; label: string }
  | { kind: 'success'; label: string; txId: string }
  | { kind: 'error'; label: string; message: string };

const LAST_MARKET_KEY = 'nightbid:last-market';

/** Turns wallet/contract failures into short, human messages. */
export const friendlyError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  const known: [RegExp, string][] = [
    [/rejected|Rejected|PermissionRejected/, 'You rejected the request in your wallet.'],
    [/bid exceeds budget/, 'Your bid is above the gig budget.'],
    [/bid must be positive/, 'Bids must be greater than zero.'],
    [/client cannot bid on own gig/, "You can't bid on your own gig."],
    [/bidding is not open/, 'Bidding is closed for this gig.'],
    [/only the client/, 'Only the client who posted this gig can do that.'],
    [/no matching sealed bid/, "Your reveal doesn't match your sealed bid."],
    [/a lower claim already leads/, 'A lower bid has already been revealed — you were outbid.'],
    [/no verified claims/, 'No bidder has revealed a winning bid yet.'],
    [/Insufficient|insufficient|DUST|dust/, 'Not enough tDUST to pay fees. Top up from the faucet.'],
  ];
  return known.find(([pattern]) => pattern.test(raw))?.[1] ?? raw;
};

export function useNightBid() {
  const [wallets, setWallets] = useState<InitialAPI[]>([]);
  const [session, setSession] = useState<WalletSession>();
  const [market, setMarket] = useState<NightBidMarket>();
  const [marketState, setMarketState] = useState<PublicMarketState>();
  const [tx, setTx] = useState<TxStatus>({ kind: 'idle' });
  const [bidsVersion, setBidsVersion] = useState(0);

  // Wallet extensions inject asynchronously; poll briefly.
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      const found = detectWallets();
      setWallets(found);
      if (found.length > 0 || ++tries > 20) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!market) return;
    const sub = market.state$().subscribe({
      next: setMarketState,
      error: (e) => setTx({ kind: 'error', label: 'Live updates', message: friendlyError(e) }),
    });
    return () => sub.unsubscribe();
  }, [market]);

  const run = useCallback(
    async (label: string, action: () => Promise<string | void>) => {
      setTx({ kind: 'pending', label });
      try {
        const txId = await action();
        setTx(txId ? { kind: 'success', label, txId } : { kind: 'idle' });
        setBidsVersion((v) => v + 1);
      } catch (error) {
        console.error(error);
        setTx({ kind: 'error', label, message: friendlyError(error) });
      }
    },
    [],
  );

  const connect = useCallback(
    (wallet: InitialAPI) =>
      run('Connecting wallet', async () => {
        const s = await connectWallet(wallet);
        setSession(s);
        const remembered = DEFAULT_CONTRACT_ADDRESS ?? localStorage.getItem(LAST_MARKET_KEY);
        if (remembered) {
          const m = await NightBidMarket.join(s.providers, s.shieldedAddress, remembered);
          setMarket(m);
        }
      }),
    [run],
  );

  const openMarket = (m: NightBidMarket) => {
    localStorage.setItem(LAST_MARKET_KEY, m.contractAddress);
    setMarketState(undefined);
    setMarket(m);
  };

  const deployMarket = () =>
    run('Deploying NightBid market', async () => {
      if (!session) return;
      const m = await NightBidMarket.deploy(session.providers, session.shieldedAddress);
      openMarket(m);
      return m.contractAddress;
    });

  const joinMarket = (address: string) =>
    run('Joining market', async () => {
      if (!session) return;
      openMarket(await NightBidMarket.join(session.providers, session.shieldedAddress, address.trim()));
    });

  const leaveMarket = () => {
    localStorage.removeItem(LAST_MARKET_KEY);
    setMarket(undefined);
    setMarketState(undefined);
  };

  return {
    wallets,
    session,
    market,
    marketState,
    mySealedBids: market ? market.mySealedBids() : [],
    bidsVersion,
    tx,
    dismissTx: () => setTx({ kind: 'idle' }),
    connect,
    deployMarket,
    joinMarket,
    leaveMarket,
    run,
  };
}
