import { create } from 'zustand';

export interface Shortcut {
  id: string;
  label: string;
  keys: string; // e.g. "Meta+b", "Meta+1"
}

interface ShortcutState {
  shortcuts: Shortcut[];
  commandDown: boolean;
  loaded: boolean;
  getShortcut: (id: string) => Shortcut | undefined;
  setShortcutKeys: (id: string, keys: string) => { success: boolean; conflict?: string };
  resetShortcut: (id: string) => void;
  resetAll: () => void;
  loadShortcuts: () => Promise<void>;
  formatKeys: (keys: string) => string;
  setCommandDown: (down: boolean) => void;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 'toggleSidebar', label: 'Toggle Sidebar', keys: 'Meta+b' },
  { id: 'focusSearch', label: 'Focus Search', keys: 'Meta+k' },
  { id: 'goAllPapers', label: 'Go to My Library', keys: 'Meta+1' },
  { id: 'goSearch', label: 'Go to Search', keys: 'Meta+2' },
  { id: 'goFavorites', label: 'Go to Favorites', keys: 'Meta+3' },
  { id: 'goRecent', label: 'Go to Recently Added', keys: 'Meta+4' },
  { id: 'toggleFavorite', label: 'Toggle Favorite', keys: 'Meta+d' },
  { id: 'toggleSettings', label: 'Open Settings', keys: 'Meta+,' },
  { id: 'savePaper', label: 'Save Paper', keys: 'Meta+s' },
  { id: 'highlightSelection', label: 'Highlight Selection', keys: 'Meta+e' },
  { id: 'importPdfs', label: 'Import PDFs', keys: 'Meta+i' },
  { id: 'toggleMcp', label: 'Toggle MCP Server', keys: 'Meta+t' },
];

function buildOverridesFromShortcuts(shortcuts: Shortcut[]): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const shortcut of shortcuts) {
    const defaultShortcut = DEFAULT_SHORTCUTS.find((d) => d.id === shortcut.id);
    if (defaultShortcut && defaultShortcut.keys !== shortcut.keys) {
      overrides[shortcut.id] = shortcut.keys;
    }
  }
  return overrides;
}

function applyOverrides(overrides: Record<string, string>): Shortcut[] {
  return DEFAULT_SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    keys: overrides[shortcut.id] ?? shortcut.keys,
  }));
}

export function formatKeys(keys: string): string {
  const parts = keys.split('+');
  const formatted = parts.map((part) => {
    switch (part) {
      case 'Meta':
        return '⌘';
      case 'Shift':
        return '⇧';
      case 'Alt':
        return '⌥';
      case 'Control':
        return '⌃';
      default:
        return part.toUpperCase();
    }
  });
  return formatted.join('');
}

export function buildKeyString(event: KeyboardEvent): string | null {
  const key = event.key;
  // Ignore lone modifier presses
  if (['Meta', 'Shift', 'Alt', 'Control'].includes(key)) return null;

  const parts: string[] = [];
  if (event.metaKey) parts.push('Meta');
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  // Require at least one modifier for a valid shortcut
  if (parts.length === 0) return null;

  parts.push(key.length === 1 ? key.toLowerCase() : key);
  return parts.join('+');
}

export function getDefaultKeys(id: string): string | undefined {
  return DEFAULT_SHORTCUTS.find((s) => s.id === id)?.keys;
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  shortcuts: DEFAULT_SHORTCUTS.map((s) => ({ ...s })),
  commandDown: false,
  loaded: false,

  getShortcut: (id) => get().shortcuts.find((s) => s.id === id),

  loadShortcuts: async () => {
    const overrides = await window.electronAPI.getShortcutOverrides();
    set({ shortcuts: applyOverrides(overrides), loaded: true });
  },

  setShortcutKeys: (id, keys) => {
    const { shortcuts } = get();
    const conflict = shortcuts.find((s) => s.id !== id && s.keys === keys);
    if (conflict) {
      return { success: false, conflict: conflict.label };
    }
    const updated = shortcuts.map((s) => (s.id === id ? { ...s, keys } : s));
    const overrides = buildOverridesFromShortcuts(updated);
    window.electronAPI.saveShortcutOverrides(overrides);
    set({ shortcuts: updated });
    return { success: true };
  },

  resetShortcut: (id) => {
    const defaultKeys = getDefaultKeys(id);
    if (!defaultKeys) return;
    const { shortcuts } = get();
    const updated = shortcuts.map((s) => (s.id === id ? { ...s, keys: defaultKeys } : s));
    const overrides = buildOverridesFromShortcuts(updated);
    window.electronAPI.saveShortcutOverrides(overrides);
    set({ shortcuts: updated });
  },

  resetAll: () => {
    window.electronAPI.saveShortcutOverrides({});
    set({ shortcuts: DEFAULT_SHORTCUTS.map((s) => ({ ...s })) });
  },

  formatKeys,
  setCommandDown: (down) => set({ commandDown: down }),
}));
