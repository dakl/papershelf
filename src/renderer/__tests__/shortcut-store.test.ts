import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
});

// Mock electronAPI for store methods that call it
vi.stubGlobal('window', {
  ...globalThis.window,
  electronAPI: {
    getShortcutOverrides: vi.fn(() => Promise.resolve({})),
    saveShortcutOverrides: vi.fn(),
  },
});

import { buildKeyString, formatKeys, getDefaultKeys, useShortcutStore } from '../stores/shortcutStore';

function fakeKeyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  } as KeyboardEvent;
}

beforeEach(() => {
  useShortcutStore.getState().resetAll();
});

// --- buildKeyString ---

describe('buildKeyString', () => {
  it('returns null for lone modifier presses', () => {
    expect(buildKeyString(fakeKeyEvent({ key: 'Meta', metaKey: true }))).toBeNull();
    expect(buildKeyString(fakeKeyEvent({ key: 'Shift', shiftKey: true }))).toBeNull();
    expect(buildKeyString(fakeKeyEvent({ key: 'Alt', altKey: true }))).toBeNull();
    expect(buildKeyString(fakeKeyEvent({ key: 'Control', ctrlKey: true }))).toBeNull();
  });

  it('returns null when no modifier is held', () => {
    expect(buildKeyString(fakeKeyEvent({ key: 'f' }))).toBeNull();
    expect(buildKeyString(fakeKeyEvent({ key: 'Enter' }))).toBeNull();
  });

  it('builds Meta+key strings', () => {
    expect(buildKeyString(fakeKeyEvent({ key: 'f', metaKey: true }))).toBe('Meta+f');
    expect(buildKeyString(fakeKeyEvent({ key: 'b', metaKey: true }))).toBe('Meta+b');
  });

  it('lowercases single-char keys', () => {
    expect(buildKeyString(fakeKeyEvent({ key: 'F', metaKey: true }))).toBe('Meta+f');
  });

  it('preserves multi-char key names', () => {
    expect(buildKeyString(fakeKeyEvent({ key: 'Enter', metaKey: true }))).toBe('Meta+Enter');
    expect(buildKeyString(fakeKeyEvent({ key: 'Escape', ctrlKey: true }))).toBe('Control+Escape');
  });

  it('combines multiple modifiers in order', () => {
    expect(buildKeyString(fakeKeyEvent({ key: 'g', metaKey: true, shiftKey: true }))).toBe('Meta+Shift+g');
    expect(buildKeyString(fakeKeyEvent({ key: 'z', metaKey: true, altKey: true }))).toBe('Meta+Alt+z');
  });
});

// --- formatKeys ---

describe('formatKeys', () => {
  it('formats Meta as ⌘', () => {
    expect(formatKeys('Meta+f')).toBe('⌘F');
  });

  it('formats Shift as ⇧', () => {
    expect(formatKeys('Meta+Shift+g')).toBe('⌘⇧G');
  });

  it('formats Alt as ⌥', () => {
    expect(formatKeys('Meta+Alt+z')).toBe('⌘⌥Z');
  });

  it('formats Control as ⌃', () => {
    expect(formatKeys('Control+c')).toBe('⌃C');
  });
});

// --- Default shortcuts ---

describe('default shortcuts', () => {
  it('includes findInPdf shortcut', () => {
    const shortcut = useShortcutStore.getState().getShortcut('findInPdf');
    expect(shortcut).toBeDefined();
    expect(shortcut?.keys).toBe('Meta+f');
    expect(shortcut?.label).toBe('Find in PDF');
  });

  it('includes highlightSelection shortcut', () => {
    const shortcut = useShortcutStore.getState().getShortcut('highlightSelection');
    expect(shortcut).toBeDefined();
    expect(shortcut?.keys).toBe('Meta+e');
  });

  it('returns undefined for unknown shortcut IDs', () => {
    expect(useShortcutStore.getState().getShortcut('nonexistent')).toBeUndefined();
  });

  it('getDefaultKeys returns the default for known IDs', () => {
    expect(getDefaultKeys('findInPdf')).toBe('Meta+f');
    expect(getDefaultKeys('toggleSidebar')).toBe('Meta+b');
  });

  it('getDefaultKeys returns undefined for unknown IDs', () => {
    expect(getDefaultKeys('nonexistent')).toBeUndefined();
  });
});

// --- Shortcut remapping ---

describe('shortcut remapping', () => {
  it('remaps a shortcut and finds it by new keys', () => {
    const store = useShortcutStore.getState();
    const result = store.setShortcutKeys('findInPdf', 'Meta+Shift+f');
    expect(result.success).toBe(true);

    const updated = useShortcutStore.getState().getShortcut('findInPdf');
    expect(updated?.keys).toBe('Meta+Shift+f');
  });

  it('detects conflicts when remapping to an existing key', () => {
    const store = useShortcutStore.getState();
    // Try to remap findInPdf to Meta+b which is toggleSidebar
    const result = store.setShortcutKeys('findInPdf', 'Meta+b');
    expect(result.success).toBe(false);
    expect(result.conflict).toBe('Toggle Sidebar');
  });

  it('resets a shortcut to default', () => {
    const store = useShortcutStore.getState();
    store.setShortcutKeys('findInPdf', 'Meta+Shift+f');
    expect(useShortcutStore.getState().getShortcut('findInPdf')?.keys).toBe('Meta+Shift+f');

    useShortcutStore.getState().resetShortcut('findInPdf');
    expect(useShortcutStore.getState().getShortcut('findInPdf')?.keys).toBe('Meta+f');
  });

  it('resetAll restores all defaults', () => {
    const store = useShortcutStore.getState();
    store.setShortcutKeys('findInPdf', 'Meta+Shift+f');
    store.setShortcutKeys('toggleSidebar', 'Meta+Shift+b');

    useShortcutStore.getState().resetAll();

    expect(useShortcutStore.getState().getShortcut('findInPdf')?.keys).toBe('Meta+f');
    expect(useShortcutStore.getState().getShortcut('toggleSidebar')?.keys).toBe('Meta+b');
  });

  it('remapped shortcut is found via key lookup (simulating keyboard dispatch)', () => {
    useShortcutStore.getState().setShortcutKeys('findInPdf', 'Meta+Shift+f');

    const keyString = buildKeyString(fakeKeyEvent({ key: 'f', metaKey: true, shiftKey: true }));
    const match = useShortcutStore.getState().shortcuts.find((s) => s.keys === keyString);
    expect(match?.id).toBe('findInPdf');

    // Old key should no longer match findInPdf
    const oldKeyString = buildKeyString(fakeKeyEvent({ key: 'f', metaKey: true }));
    const oldMatch = useShortcutStore.getState().shortcuts.find((s) => s.keys === oldKeyString);
    expect(oldMatch?.id).not.toBe('findInPdf');
  });
});
