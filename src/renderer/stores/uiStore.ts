import { create } from 'zustand';
import type { ArxivPaper } from '../../shared/types';

export type SidebarView = 'search' | 'all-papers' | 'favorites' | 'recent' | 'collection' | 'tag';

interface UIState {
  sidebarView: SidebarView;
  selectedPaper: ArxivPaper | null;
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  setSidebarView: (view: SidebarView) => void;
  setSelectedPaper: (paper: ArxivPaper | null) => void;
  navigateToCollection: (collectionId: string) => void;
  navigateToTag: (tagId: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarView: 'search',
  selectedPaper: null,
  selectedCollectionId: null,
  selectedTagId: null,
  setSidebarView: (view) => set({ sidebarView: view, selectedPaper: null, selectedCollectionId: null, selectedTagId: null }),
  setSelectedPaper: (paper) => set({ selectedPaper: paper }),
  navigateToCollection: (collectionId) => set({ sidebarView: 'collection', selectedCollectionId: collectionId, selectedPaper: null }),
  navigateToTag: (tagId) => set({ sidebarView: 'tag', selectedTagId: tagId, selectedPaper: null }),
}));
