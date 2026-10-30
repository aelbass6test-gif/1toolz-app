
import React from 'react';
import { registerSW } from 'virtual:pwa-register';
import { createRoot } from 'react-dom/client';
import './index.css';
import './utils/inAppAlert';
// FIX: The App component should be the default export which is the AppWrapper.
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import reportWebVitals from './reportWebVitals';

// Keep the active PWA worker in sync with deployed assets. With autoUpdate,
// explicitly importing registerSW allows the plugin to reload open tabs after
// a new worker activates instead of leaving users on a stale cached app shell.
registerSW({ immediate: true });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

reportWebVitals(console.log);

// AI Studio always uses an `index.tsx` file for all project types.
