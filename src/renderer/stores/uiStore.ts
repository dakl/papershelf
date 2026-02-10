import { create } from 'zustand';
import type { ArxivPaper } from '../../shared/types';

export type SidebarView =
  | 'search'
  | 'all-papers'
  | 'favorites'
  | 'recent'
  | 'collection'
  | 'tag'
  | 'citations'
  | 'settings';

interface UIState {
  sidebarView: SidebarView;
  selectedPaper: ArxivPaper | null;
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  citationSeedArxivIds: string[];
  setSidebarView: (view: SidebarView) => void;
  setSelectedPaper: (paper: ArxivPaper | null) => void;
  navigateToCollection: (collectionId: string) => void;
  navigateToTag: (tagId: string) => void;
  navigateToCitations: (arxivIds: string[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarView: 'search',
  selectedPaper: null,
  selectedCollectionId: null,
  selectedTagId: null,
  citationSeedArxivIds: [],
  setSidebarView: (view) =>
    set({
      sidebarView: view,
      selectedPaper: null,
      selectedCollectionId: null,
      selectedTagId: null,
      citationSeedArxivIds: [],
    }),
  setSelectedPaper: (paper) => set({ selectedPaper: paper }),
  navigateToCollection: (collectionId) =>
    set({ sidebarView: 'collection', selectedCollectionId: collectionId, selectedPaper: null }),
  navigateToTag: (tagId) => set({ sidebarView: 'tag', selectedTagId: tagId, selectedPaper: null }),
  navigateToCitations: (arxivIds) =>
    set({ sidebarView: 'citations', citationSeedArxivIds: arxivIds, selectedPaper: null }),
}));
