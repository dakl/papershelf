import type { ReactNode } from 'react';
import { createElement } from 'react';
import { create } from 'zustand';

export interface Shortcut {
  id: string;
  label: string;
  keys: string; // e.g. "Meta+b", "Meta+1"
}

interface ShortcutState {
  shortcuts: Shortcut[];
  getShortcut: (id: string) => Shortcut | undefined;
  setShortcutKeys: (id: string, keys: string) => { success: boolean; conflict?: string };
  resetShortcut: (id: string) => void;
  resetAll: () => void;
  formatKeys: (keys: string) => string;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 'toggleSidebar', label: 'Toggle Sidebar', keys: 'Meta+b' },
  { id: 'focusSearch', label: 'Focus Search', keys: 'Meta+k' },
  { id: 'goSearch', label: 'Go to Search', keys: 'Meta+1' },
  { id: 'goAllPapers', label: 'Go to All Papers', keys: 'Meta+2' },
  { id: 'goFavorites', label: 'Go to Favorites', keys: 'Meta+3' },
  { id: 'goRecent', label: 'Go to Recently Added', keys: 'Meta+4' },
  { id: 'goCitations', label: 'Go to Citations', keys: 'Meta+5' },
  { id: 'toggleFavorite', label: 'Toggle Favorite', keys: 'Meta+d' },
  { id: 'toggleSettings', label: 'Open Settings', keys: 'Meta+,' },
];

const STORAGE_KEY = 'shortcuts';

function loadOverrides(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return {};
}

function saveOverrides(shortcuts: Shortcut[]) {
  const overrides: Record<string, string> = {};
  for (const shortcut of shortcuts) {
    const defaultShortcut = DEFAULT_SHORTCUTS.find((d) => d.id === shortcut.id);
    if (defaultShortcut && defaultShortcut.keys !== shortcut.keys) {
      overrides[shortcut.id] = shortcut.keys;
    }
  }
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }
}

function buildShortcuts(): Shortcut[] {
  const overrides = loadOverrides();
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

export function FormattedShortcut({ keys }: { keys: string }): ReactNode {
  const parts = keys.split('+');
  const children: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let symbol: string;
    let isModifier = false;
    switch (part) {
      case 'Meta':
        symbol = '⌘';
        isModifier = true;
        break;
      case 'Shift':
        symbol = '⇧';
        isModifier = true;
        break;
      case 'Alt':
        symbol = '⌥';
        isModifier = true;
        break;
      case 'Control':
        symbol = '⌃';
        isModifier = true;
        break;
      default:
        symbol = part.toUpperCase();
    }
    if (isModifier) {
      children.push(createElement('span', { key: i, style: { fontSize: '1.25em', lineHeight: 0 } }, symbol));
    } else {
      children.push(symbol);
    }
  }
  return createElement('span', { style: { display: 'inline-flex', alignItems: 'center' } }, ...children);
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
  shortcuts: buildShortcuts(),

  getShortcut: (id) => get().shortcuts.find((s) => s.id === id),

  setShortcutKeys: (id, keys) => {
    const { shortcuts } = get();
    const conflict = shortcuts.find((s) => s.id !== id && s.keys === keys);
    if (conflict) {
      return { success: false, conflict: conflict.label };
    }
    const updated = shortcuts.map((s) => (s.id === id ? { ...s, keys } : s));
    saveOverrides(updated);
    set({ shortcuts: updated });
    return { success: true };
  },

  resetShortcut: (id) => {
    const defaultKeys = getDefaultKeys(id);
    if (!defaultKeys) return;
    const { shortcuts } = get();
    const updated = shortcuts.map((s) => (s.id === id ? { ...s, keys: defaultKeys } : s));
    saveOverrides(updated);
    set({ shortcuts: updated });
  },

  resetAll: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ shortcuts: DEFAULT_SHORTCUTS.map((s) => ({ ...s })) });
  },

  formatKeys,
}));
