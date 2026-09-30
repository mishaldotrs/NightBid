import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createLogger, defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

const shim = (file: string) => fileURLToPath(new URL(`./src/shims/${file}`, import.meta.url));

// Midnight packages ship sourcemaps without sources; hide that harmless noise.
const logger = createLogger();
const isSourcemapNoise = (msg: string) => msg.includes('points to missing source files');
const { warn, warnOnce } = logger;
logger.warn = (msg, options) => !isSourcemapNoise(msg) && warn(msg, options);
logger.warnOnce = (msg, options) => !isSourcemapNoise(msg) && warnOnce(msg, options);

export default defineConfig({
  // GitHub Pages serves the app from /NightBid/; local dev and Vercel use /.
  base: process.env.BASE_PATH ?? '/',
  customLogger: logger,
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
    // WASM packages can't be pre-bundled by esbuild. midnight-js-protocol
    // re-exports them via `export *`, which esbuild can't resolve against an
    // excluded module in dev, so it must stay un-bundled too.
    exclude: [
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/ledger-v8',
      '@midnight-ntwrk/midnight-js-protocol',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  // esnext supports top-level await natively (used by the WASM runtimes).
  esbuild: { target: 'esnext' },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 8000,
  },
});
