import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useCallback, useEffect, useState } from 'react';
import { friendlyError } from './errors';
import { DEFAULT_CONTRACT_ADDRESS } from './midnight/config';
import { NightBidMarket, type PublicMarketState } from './midnight/nightbid-api';
import { connectWallet, detectWallets, type WalletSession } from './midnight/providers';

export type TxStatus =
  | { kind: 'idle' }
  | { kind: 'pending'; label: string }
  | { kind: 'success'; label: string; txId: string }
  | { kind: 'error'; label: string; message: string };

const LAST_MARKET_KEY = 'nightbid:last-market';


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
