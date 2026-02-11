import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

// Prevent Chromium's built-in zoom so Cmd+/-, Cmd+0, and pinch-to-zoom
// can be handled by the PDF viewer instead
document.addEventListener('keydown', (event) => {
  if (event.metaKey && (event.key === '=' || event.key === '+' || event.key === '-' || event.key === '0')) {
    event.preventDefault();
  }
});
document.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) event.preventDefault();
  },
  { passive: false },
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
