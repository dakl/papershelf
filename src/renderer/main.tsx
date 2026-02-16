import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { handleCmdHorizontal, handleCmdVertical } from './keyboard-navigation';
import { usePaperStore } from './stores/paperStore';
import { buildKeyString, useShortcutStore } from './stores/shortcutStore';
import { toast } from './stores/toastStore';
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

  // Cmd+Up/Down: navigate items in the active panel
  if (event.metaKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault();
    handleCmdVertical(event.key === 'ArrowDown' ? 1 : -1);
    return;
  }

  // Cmd+Left/Right: switch between panels
  if (event.metaKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    handleCmdHorizontal(event.key === 'ArrowRight' ? 'right' : 'left');
    return;
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
      if (sidebarView !== 'search') {
        toast('Switch to Search to save papers', 'info');
      } else if (!searchPaper) {
        toast('Select a search result to save', 'info');
      } else if (usePaperStore.getState().libraryPaperIds.has(searchPaper.id)) {
        toast('Paper already in library', 'info');
      } else {
        usePaperStore.getState().savePaper(searchPaper);
      }
      break;
    }
    case 'highlightSelection':
      document.dispatchEvent(new CustomEvent('shortcut:highlightSelection'));
      break;
  }
});

// Keyboard navigation for panel switching and list traversal
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  const isTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

  // Escape always works: blur inputs or back out of panels
  if (event.key === 'Escape') {
    if (isTextInput) {
      target.blur();
      useUIStore.getState().setActivePanel('list');
      event.preventDefault();
      return;
    }
    const { activePanel } = useUIStore.getState();
    if (activePanel === 'detail') {
      useUIStore.getState().setActivePanel('list');
    } else if (activePanel === 'list') {
      useUIStore.getState().setActivePanel('sidebar');
    }
    event.preventDefault();
    return;
  }

  // Don't intercept other keys when in text input
  if (isTextInput) return;
  // Don't intercept keys with modifiers (handled by shortcut system)
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const ui = useUIStore.getState();

  if (event.key === 'Tab') {
    event.preventDefault();
    const panels = ui.sidebarCollapsed ? (['list', 'detail'] as const) : (['sidebar', 'list', 'detail'] as const);
    const currentIndex = panels.indexOf(ui.activePanel);
    if (event.shiftKey) {
      const prevIndex = currentIndex <= 0 ? panels.length - 1 : currentIndex - 1;
      useUIStore.getState().setActivePanel(panels[prevIndex]);
    } else {
      const nextIndex = currentIndex >= panels.length - 1 ? 0 : currentIndex + 1;
      useUIStore.getState().setActivePanel(panels[nextIndex]);
    }
    return;
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const direction = event.key === 'ArrowDown' ? 1 : -1;

    if (ui.activePanel === 'list') {
      event.preventDefault();
      const { focusedPaperIndex, paperListLength } = ui;
      if (paperListLength === 0) return;
      const newIndex = Math.max(0, Math.min(paperListLength - 1, focusedPaperIndex + direction));
      if (newIndex !== focusedPaperIndex) {
        useUIStore.getState().setFocusedPaperIndex(newIndex);
      }
      return;
    }

    if (ui.activePanel === 'sidebar') {
      event.preventDefault();
      const { sidebarFocusIndex, sidebarItemCount } = ui;
      if (sidebarItemCount === 0) return;
      const newIndex = Math.max(0, Math.min(sidebarItemCount - 1, sidebarFocusIndex + direction));
      if (newIndex !== sidebarFocusIndex) {
        useUIStore.getState().setSidebarFocusIndex(newIndex);
      }
      return;
    }
    // detail panel: don't intercept, let PDF scroll
    return;
  }

  if (event.key === 'Enter') {
    if (ui.activePanel === 'sidebar') {
      useUIStore.getState().setActivePanel('list');
      event.preventDefault();
    } else if (ui.activePanel === 'list') {
      useUIStore.getState().setActivePanel('detail');
      event.preventDefault();
    }
    return;
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
if ((window as unknown as Record<string, unknown>).electronAPI) {
  (window as unknown as Record<string, unknown>).__shortcutStore = useShortcutStore;
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
