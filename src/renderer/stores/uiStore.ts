import { create } from 'zustand';
import type { ArxivPaper, SortBy, SortOrder } from '../../shared/types';
import { PAPER_LIST_DEFAULT_WIDTH, PAPER_LIST_MAX_WIDTH, PAPER_LIST_MIN_WIDTH } from '../constants';

export type SidebarView = 'search' | 'all-papers' | 'favorites' | 'recent' | 'collection' | 'tag' | 'settings';

interface UIState {
  sidebarView: SidebarView;
  selectedPaper: ArxivPaper | null;
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  sidebarCollapsed: boolean;
  paperListWidth: number;
  sortBy: SortBy;
  sortOrder: SortOrder;
  setSidebarView: (view: SidebarView) => void;
  setSelectedPaper: (paper: ArxivPaper | null) => void;
  navigateToCollection: (collectionId: string) => void;
  navigateToTag: (tagId: string) => void;
  toggleSidebar: () => void;
  setPaperListWidth: (width: number) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (sortOrder: SortOrder) => void;
  toggleSortOrder: () => void;
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

function loadSortBy(): SortBy {
  try {
    const stored = localStorage.getItem('sortBy');
    if (stored === 'created_at' || stored === 'published_date' || stored === 'title' || stored === 'first_author')
      return stored;
  } catch {
    // fall through
  }
  return 'created_at';
}

function loadSortOrder(): SortOrder {
  try {
    const stored = localStorage.getItem('sortOrder');
    if (stored === 'asc' || stored === 'desc') return stored;
  } catch {
    // fall through
  }
  return 'desc';
}

export const useUIStore = create<UIState>((set) => ({
  sidebarView: 'all-papers',
  selectedPaper: null,
  selectedCollectionId: null,
  selectedTagId: null,
  sidebarCollapsed: loadSidebarCollapsed(),
  paperListWidth: loadPaperListWidth(),
  sortBy: loadSortBy(),
  sortOrder: loadSortOrder(),
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
  setSortBy: (sortBy) => {
    const sortOrder = sortBy === 'title' || sortBy === 'first_author' ? 'asc' : 'desc';
    localStorage.setItem('sortBy', sortBy);
    localStorage.setItem('sortOrder', sortOrder);
    set({ sortBy, sortOrder });
  },
  setSortOrder: (sortOrder) => {
    localStorage.setItem('sortOrder', sortOrder);
    set({ sortOrder });
  },
  toggleSortOrder: () =>
    set((state) => {
      const sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      localStorage.setItem('sortOrder', sortOrder);
      return { sortOrder };
    }),
}));
