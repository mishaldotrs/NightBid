import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { getNetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Transaction, type FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  createProofProvider,
  type MidnightProvider,
  type MidnightProviders,
  type ProofProvider,
  type UnboundTransaction,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import {
  fromHex,
  parseCoinPublicKeyToHex,
  parseEncPublicKeyToHex,
  toHex,
  validatePassword,
} from '@midnight-ntwrk/midnight-js-utils';
import type { NightBidPrivateState } from 'nightbid-contract';
import { NETWORK_ID, zkArtifactsBaseUrl, type NightBidCircuitId } from './config';

export type NightBidProviders = MidnightProviders<
  NightBidCircuitId,
  string,
  NightBidPrivateState
>;

export type WalletSession = {
  api: ConnectedAPI;
  walletName: string;
  networkId: string;
  shieldedAddress: string;
  providers: NightBidProviders;
};

/** Every Midnight wallet (Lace, …) injected into `window.midnight`. */
export const detectWallets = (): InitialAPI[] =>
  Object.values(window.midnight ?? {}).filter(
    (w): w is InitialAPI => typeof w?.connect === 'function',
  );

/**
 * Describes what is injected into `window.midnight`, including wallets that
 * speak an older connector API (e.g. `enable()` instead of `connect()`), so
 * users can see why a wallet isn't usable.
 */
export const describeInjectedWallets = (): string[] =>
  Object.entries(window.midnight ?? {}).map(([key, w]) => {
    const wallet = w as Partial<InitialAPI> & Record<string, unknown>;
    const methods = Object.keys(wallet).filter((k) => typeof wallet[k] === 'function');
    return `${key}: ${wallet.name ?? 'unknown'} (apiVersion ${wallet.apiVersion ?? '?'}; methods: ${methods.join(', ') || 'none'})`;
  });

const STORAGE_PASSWORD_KEY = 'nightbid:storage-password';

/**
 * The private state (the user's NightBid secret key) is encrypted at rest in
 * IndexedDB by the Level provider. We generate a strong random password per
 * browser so users aren't prompted on every visit.
 */
const storagePassword = (): string => {
  const existing = localStorage.getItem(STORAGE_PASSWORD_KEY);
  if (existing) return existing;
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const candidate = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    try {
      validatePassword(candidate);
      localStorage.setItem(STORAGE_PASSWORD_KEY, candidate);
      return candidate;
    } catch {
      // Rare: random draw produced a run/sequence. Try again.
    }
  }
};

export async function connectWallet(wallet: InitialAPI): Promise<WalletSession> {
  const api = await wallet.connect(NETWORK_ID);
  const config = await api.getConfiguration();
  setNetworkId(config.networkId);

  const { shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
    await api.getShieldedAddresses();
  const coinPublicKey = parseCoinPublicKeyToHex(shieldedCoinPublicKey, getNetworkId());
  const encryptionPublicKey = parseEncPublicKeyToHex(
    shieldedEncryptionPublicKey,
    getNetworkId(),
  );

  const zkConfigProvider = new FetchZkConfigProvider<NightBidCircuitId>(
    zkArtifactsBaseUrl(),
    fetch.bind(window),
  );

  // Prefer proving through the wallet; fall back to the proof server it advertises.
  let proofProvider: ProofProvider;
  try {
    proofProvider = createProofProvider(
      await api.getProvingProvider(zkConfigProvider.asKeyMaterialProvider()),
    );
  } catch (error) {
    if (!config.proverServerUri) throw error;
    proofProvider = httpClientProofProvider(config.proverServerUri, zkConfigProvider);
  }

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const { tx: balanced } = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced));
    },
  };

  const midnightProvider: MidnightProvider = {
    async submitTx(tx: FinalizedTransaction) {
      await api.submitTransaction(toHex(tx.serialize()));
      return tx.identifiers()[0];
    },
  };

  const providers: NightBidProviders = {
    privateStateProvider: levelPrivateStateProvider<string, NightBidPrivateState>({
      privateStoragePasswordProvider: storagePassword,
      accountId: shieldedAddress,
    }),
    publicDataProvider: indexerPublicDataProvider(
      config.indexerUri,
      config.indexerWsUri,
      WebSocket as never,
    ),
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };

  return {
    api,
    walletName: wallet.name,
    networkId: config.networkId,
    shieldedAddress,
    providers,
  };
}
