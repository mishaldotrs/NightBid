import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

const shim = (file: string) => fileURLToPath(new URL(`./src/shims/${file}`, import.meta.url));

export default defineConfig({
  plugins: [react(), wasm()],
  define: {
    // Some Midnight dependencies expect Node's `global`.
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'isomorphic-ws': shim('isomorphic-ws.ts'),
      // Browser builds of Node builtins used by level + scale-codec.
      events: 'events/',
      assert: 'assert/',
    },
    // Keep exactly one copy of the WASM runtimes in the bundle.
    dedupe: [
      '@midnight-ntwrk/compact-runtime',
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/ledger-v8',
    ],
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/onchain-runtime-v3', '@midnight-ntwrk/ledger-v8'],
    esbuildOptions: { target: 'esnext' },
  },
  // esnext supports top-level await natively (used by the WASM runtimes).
  esbuild: { target: 'esnext' },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 8000,
  },
});
