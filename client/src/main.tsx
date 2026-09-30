// Polyfills must run before any Midnight module is evaluated, so everything
// else is loaded dynamically below.
import './polyfills';

const { StrictMode } = await import('react');
const { createRoot } = await import('react-dom/client');
const { App } = await import('./App');
await import('./styles.css');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
