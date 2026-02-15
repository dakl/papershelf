import { create } from 'zustand';
import type { ArxivPaper } from '../../shared/types';
import { PAPER_LIST_DEFAULT_WIDTH, PAPER_LIST_MAX_WIDTH, PAPER_LIST_MIN_WIDTH } from '../constants';

export type SidebarView = 'search' | 'all-papers' | 'favorites' | 'recent' | 'collection' | 'tag' | 'settings';

interface UIState {
  sidebarView: SidebarView;
  selectedPaper: ArxivPaper | null;
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  sidebarCollapsed: boolean;
  paperListWidth: number;
  setSidebarView: (view: SidebarView) => void;
  setSelectedPaper: (paper: ArxivPaper | null) => void;
  navigateToCollection: (collectionId: string) => void;
  navigateToTag: (tagId: string) => void;
  toggleSidebar: () => void;
  setPaperListWidth: (width: number) => void;
}

function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  } catch {
    return false;
  }
}

function loadPaperListWidth(): number {
  try {
    const stored = localStorage.getItem('paperListWidth');
    if (stored) {
      const width = Number(stored);
      if (width >= PAPER_LIST_MIN_WIDTH && width <= PAPER_LIST_MAX_WIDTH) return width;
    }
  } catch {
    // fall through
  }
  return PAPER_LIST_DEFAULT_WIDTH;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarView: 'all-papers',
  selectedPaper: null,
  selectedCollectionId: null,
  selectedTagId: null,
  sidebarCollapsed: loadSidebarCollapsed(),
  paperListWidth: loadPaperListWidth(),
  setSidebarView: (view) =>
    set({
      sidebarView: view,
      selectedPaper: null,
      selectedCollectionId: null,
      selectedTagId: null,
    }),
  setSelectedPaper: (paper) => set({ selectedPaper: paper }),
  navigateToCollection: (collectionId) =>
    set({ sidebarView: 'collection', selectedCollectionId: collectionId, selectedPaper: null }),
  navigateToTag: (tagId) => set({ sidebarView: 'tag', selectedTagId: tagId, selectedPaper: null }),
  toggleSidebar: () =>
    set((state) => {
      const collapsed = !state.sidebarCollapsed;
      localStorage.setItem('sidebarCollapsed', String(collapsed));
      return { sidebarCollapsed: collapsed };
    }),
  setPaperListWidth: (width) => {
    const clamped = Math.max(PAPER_LIST_MIN_WIDTH, Math.min(PAPER_LIST_MAX_WIDTH, width));
    localStorage.setItem('paperListWidth', String(clamped));
    set({ paperListWidth: clamped });
  },
}));
