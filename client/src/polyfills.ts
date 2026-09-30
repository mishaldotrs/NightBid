import { Buffer } from 'buffer';

// Midnight's address-format library relies on a global Buffer.
globalThis.Buffer ??= Buffer;

// Browser builds of Node's `util`/`assert` (used by Midnight deps) read
// `process.env`. Provide the minimal shape they expect.
const g = globalThis as unknown as { process?: Record<string, unknown> };
g.process ??= {
  env: {},
  browser: true,
  version: '',
  versions: {},
  nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    queueMicrotask(() => fn(...args)),
};
