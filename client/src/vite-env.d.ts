/// <reference types="vite/client" />
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

interface ImportMetaEnv {
  readonly VITE_NETWORK_ID?: string;
  readonly VITE_CONTRACT_ADDRESS?: string;
}

declare global {
  interface Window {
    midnight?: { [key: string]: InitialAPI };
  }
}

export {};
