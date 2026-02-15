import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { usePaperStore } from './stores/paperStore';
import { buildKeyString, useShortcutStore } from './stores/shortcutStore';
import { useUIStore } from './stores/uiStore';
import './styles/globals.css';

// Load persisted shortcut overrides from disk
useShortcutStore.getState().loadShortcuts();

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
    case 'savePaper': {
      const { sidebarView, selectedPaper: searchPaper } = ui;
      if (sidebarView === 'search' && searchPaper) {
        usePaperStore.getState().savePaper(searchPaper);
      }
      break;
    }
    case 'highlightSelection':
      document.dispatchEvent(new CustomEvent('shortcut:highlightSelection'));
      break;
  }
});

// Track Command key held state for inline shortcut hints
const { setCommandDown } = useShortcutStore.getState();
document.addEventListener('keydown', (event) => {
  if (event.key === 'Meta') setCommandDown(true);
});
document.addEventListener('keyup', (event) => {
  if (event.key === 'Meta') setCommandDown(false);
});
window.addEventListener('blur', () => setCommandDown(false));

// Expose store for e2e screenshot automation
if ((window as any).electronAPI) {
  (window as any).__shortcutStore = useShortcutStore;
}

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
