import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage before importing the store
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
});

import { handleCmdHorizontal, handleCmdVertical } from '../keyboard-navigation';
import { useUIStore } from '../stores/uiStore';

function resetStore(overrides: Record<string, unknown> = {}) {
  useUIStore.setState({
    activePanel: 'list',
    focusedPaperIndex: 0,
    paperListLength: 0,
    sidebarFocusIndex: 0,
    sidebarItemCount: 0,
    sidebarCollapsed: false,
    ...overrides,
  });
}

beforeEach(() => {
  resetStore();
});

// --- Cmd+Up/Down: paper navigation ---

describe('Cmd+Up/Down paper navigation', () => {
  it('navigates down through papers', () => {
    resetStore({ paperListLength: 5, focusedPaperIndex: 0, activePanel: 'list' });
    handleCmdVertical(1);
    expect(useUIStore.getState().focusedPaperIndex).toBe(1);
  });

  it('navigates up through papers', () => {
    resetStore({ paperListLength: 5, focusedPaperIndex: 3, activePanel: 'list' });
    handleCmdVertical(-1);
    expect(useUIStore.getState().focusedPaperIndex).toBe(2);
  });

  it('clamps at the bottom of the list', () => {
    resetStore({ paperListLength: 5, focusedPaperIndex: 4, activePanel: 'list' });
    handleCmdVertical(1);
    expect(useUIStore.getState().focusedPaperIndex).toBe(4);
  });

  it('clamps at the top of the list', () => {
    resetStore({ paperListLength: 5, focusedPaperIndex: 0, activePanel: 'list' });
    handleCmdVertical(-1);
    expect(useUIStore.getState().focusedPaperIndex).toBe(0);
  });

  it('does nothing with an empty list', () => {
    resetStore({ paperListLength: 0, focusedPaperIndex: 0, activePanel: 'list' });
    handleCmdVertical(1);
    expect(useUIStore.getState().focusedPaperIndex).toBe(0);
  });

  it('sets activePanel to list when navigating from detail', () => {
    resetStore({ paperListLength: 5, focusedPaperIndex: 0, activePanel: 'detail' });
    handleCmdVertical(1);
    expect(useUIStore.getState().activePanel).toBe('list');
    expect(useUIStore.getState().focusedPaperIndex).toBe(1);
  });

  it('navigates multiple steps sequentially', () => {
    resetStore({ paperListLength: 10, focusedPaperIndex: 0, activePanel: 'list' });
    handleCmdVertical(1);
    handleCmdVertical(1);
    handleCmdVertical(1);
    expect(useUIStore.getState().focusedPaperIndex).toBe(3);
    handleCmdVertical(-1);
    expect(useUIStore.getState().focusedPaperIndex).toBe(2);
  });
});

// --- Cmd+Up/Down: sidebar navigation ---

describe('Cmd+Up/Down sidebar navigation', () => {
  it('navigates down through sidebar items', () => {
    resetStore({ sidebarItemCount: 8, sidebarFocusIndex: 0, activePanel: 'sidebar' });
    handleCmdVertical(1);
    expect(useUIStore.getState().sidebarFocusIndex).toBe(1);
  });

  it('navigates up through sidebar items', () => {
    resetStore({ sidebarItemCount: 8, sidebarFocusIndex: 5, activePanel: 'sidebar' });
    handleCmdVertical(-1);
    expect(useUIStore.getState().sidebarFocusIndex).toBe(4);
  });

  it('clamps at the bottom of sidebar', () => {
    resetStore({ sidebarItemCount: 4, sidebarFocusIndex: 3, activePanel: 'sidebar' });
    handleCmdVertical(1);
    expect(useUIStore.getState().sidebarFocusIndex).toBe(3);
  });

  it('clamps at the top of sidebar', () => {
    resetStore({ sidebarItemCount: 4, sidebarFocusIndex: 0, activePanel: 'sidebar' });
    handleCmdVertical(-1);
    expect(useUIStore.getState().sidebarFocusIndex).toBe(0);
  });

  it('does not navigate papers when sidebar is active', () => {
    resetStore({
      sidebarItemCount: 4,
      sidebarFocusIndex: 0,
      paperListLength: 10,
      focusedPaperIndex: 5,
      activePanel: 'sidebar',
    });
    handleCmdVertical(1);
    expect(useUIStore.getState().sidebarFocusIndex).toBe(1);
    expect(useUIStore.getState().focusedPaperIndex).toBe(5);
  });

  it('does nothing with empty sidebar', () => {
    resetStore({ sidebarItemCount: 0, sidebarFocusIndex: 0, activePanel: 'sidebar' });
    handleCmdVertical(1);
    expect(useUIStore.getState().sidebarFocusIndex).toBe(0);
  });
});

// --- Cmd+Left/Right: panel switching ---

describe('Cmd+Left/Right panel switching', () => {
  it('moves right from sidebar to list', () => {
    resetStore({ activePanel: 'sidebar', sidebarCollapsed: false });
    handleCmdHorizontal('right');
    expect(useUIStore.getState().activePanel).toBe('list');
  });

  it('moves right from list to detail', () => {
    resetStore({ activePanel: 'list', sidebarCollapsed: false });
    handleCmdHorizontal('right');
    expect(useUIStore.getState().activePanel).toBe('detail');
  });

  it('stays at detail when moving right (clamps)', () => {
    resetStore({ activePanel: 'detail', sidebarCollapsed: false });
    handleCmdHorizontal('right');
    expect(useUIStore.getState().activePanel).toBe('detail');
  });

  it('moves left from detail to list', () => {
    resetStore({ activePanel: 'detail', sidebarCollapsed: false });
    handleCmdHorizontal('left');
    expect(useUIStore.getState().activePanel).toBe('list');
  });

  it('moves left from list to sidebar', () => {
    resetStore({ activePanel: 'list', sidebarCollapsed: false });
    handleCmdHorizontal('left');
    expect(useUIStore.getState().activePanel).toBe('sidebar');
  });

  it('stays at sidebar when moving left (clamps)', () => {
    resetStore({ activePanel: 'sidebar', sidebarCollapsed: false });
    handleCmdHorizontal('left');
    expect(useUIStore.getState().activePanel).toBe('sidebar');
  });

  it('full traversal: sidebar → list → detail → detail (clamped)', () => {
    resetStore({ activePanel: 'sidebar', sidebarCollapsed: false });
    handleCmdHorizontal('right');
    expect(useUIStore.getState().activePanel).toBe('list');
    handleCmdHorizontal('right');
    expect(useUIStore.getState().activePanel).toBe('detail');
    handleCmdHorizontal('right');
    expect(useUIStore.getState().activePanel).toBe('detail');
  });
});

// --- Collapsed sidebar ---

describe('Cmd+Left/Right with collapsed sidebar', () => {
  it('moves right from list to detail', () => {
    resetStore({ activePanel: 'list', sidebarCollapsed: true });
    handleCmdHorizontal('right');
    expect(useUIStore.getState().activePanel).toBe('detail');
  });

  it('moves left from detail to list', () => {
    resetStore({ activePanel: 'detail', sidebarCollapsed: true });
    handleCmdHorizontal('left');
    expect(useUIStore.getState().activePanel).toBe('list');
  });

  it('stays at list when moving left (sidebar skipped)', () => {
    resetStore({ activePanel: 'list', sidebarCollapsed: true });
    handleCmdHorizontal('left');
    expect(useUIStore.getState().activePanel).toBe('list');
  });
});

// --- uiStore state transitions ---

describe('uiStore state transitions', () => {
  it('setSidebarView resets focusedPaperIndex and activePanel', () => {
    resetStore({ focusedPaperIndex: 5, activePanel: 'detail' });
    useUIStore.getState().setSidebarView('favorites');
    const state = useUIStore.getState();
    expect(state.sidebarView).toBe('favorites');
    expect(state.focusedPaperIndex).toBe(0);
    expect(state.activePanel).toBe('list');
  });

  it('navigateToCollection sets correct state', () => {
    useUIStore.getState().navigateToCollection('col-123');
    const state = useUIStore.getState();
    expect(state.sidebarView).toBe('collection');
    expect(state.selectedCollectionId).toBe('col-123');
  });

  it('navigateToTag sets correct state', () => {
    useUIStore.getState().navigateToTag('tag-456');
    const state = useUIStore.getState();
    expect(state.sidebarView).toBe('tag');
    expect(state.selectedTagId).toBe('tag-456');
  });

  it('setPaperListLength updates the length', () => {
    useUIStore.getState().setPaperListLength(42);
    expect(useUIStore.getState().paperListLength).toBe(42);
  });

  it('setSidebarItemCount updates the count', () => {
    useUIStore.getState().setSidebarItemCount(7);
    expect(useUIStore.getState().sidebarItemCount).toBe(7);
  });
});
