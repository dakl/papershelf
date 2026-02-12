import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { usePaperStore } from './stores/paperStore';
import { buildKeyString, useShortcutStore } from './stores/shortcutStore';
import { useUIStore } from './stores/uiStore';
import './styles/globals.css';

// Prevent Chromium's built-in zoom so Cmd+/-, Cmd+0, and pinch-to-zoom
// can be handled by the PDF viewer instead
document.addEventListener('keydown', (event) => {
  if (event.metaKey && (event.key === '=' || event.key === '+' || event.key === '-' || event.key === '0')) {
    event.preventDefault();
  }

  const keyString = buildKeyString(event);
  if (!keyString) return;

  const shortcut = useShortcutStore.getState().shortcuts.find((s) => s.keys === keyString);
  if (!shortcut) return;

  event.preventDefault();

  const ui = useUIStore.getState();

  switch (shortcut.id) {
    case 'toggleSidebar':
      ui.toggleSidebar();
      break;
    case 'focusSearch':
      document.querySelector<HTMLInputElement>('[data-shortcut-focus="search"]')?.focus();
      break;
    case 'goSearch':
      ui.setSidebarView('search');
      break;
    case 'goAllPapers':
      ui.setSidebarView('all-papers');
      break;
    case 'goFavorites':
      ui.setSidebarView('favorites');
      break;
    case 'goRecent':
      ui.setSidebarView('recent');
      break;
    case 'goCitations':
      ui.setSidebarView('citations');
      break;
    case 'toggleSettings':
      ui.setSidebarView(ui.sidebarView === 'settings' ? 'search' : 'settings');
      break;
    case 'toggleFavorite': {
      const selectedPaper = usePaperStore.getState().selectedLibraryPaper;
      if (selectedPaper) {
        usePaperStore.getState().toggleFavorite(selectedPaper.id);
      }
      break;
    }
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
