import { Buffer } from 'buffer';

// Midnight's address-format library relies on a global Buffer.
globalThis.Buffer ??= Buffer;

const { StrictMode } = await import('react');
const { createRoot } = await import('react-dom/client');
const { App } = await import('./App');
await import('./styles.css');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
