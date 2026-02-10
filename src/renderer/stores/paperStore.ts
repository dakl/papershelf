import { create } from 'zustand';
import type { ArxivPaper, Collection, LibraryPaper, PaperFilter, SavePaperResult, Tag } from '../../shared/types';

interface PaperState {
  papers: LibraryPaper[];
  selectedLibraryPaper: LibraryPaper | null;
  collections: Collection[];
  tags: Tag[];
  libraryPaperIds: Set<string>;
  loading: boolean;

  // Paper actions
  loadPapers: (filter: PaperFilter) => Promise<void>;
  savePaper: (paper: ArxivPaper) => Promise<SavePaperResult>;
  deletePaper: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setSelectedLibraryPaper: (paper: LibraryPaper | null) => void;
  checkPapersInLibrary: (arxivIds: string[]) => Promise<void>;
  searchLibrary: (query: string) => Promise<void>;

  // Collection actions
  loadCollections: () => Promise<void>;
  createCollection: (name: string, color: string) => Promise<Collection>;
  updateCollection: (id: string, name: string, color: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addPaperToCollection: (paperId: string, collectionId: string) => Promise<void>;
  removePaperFromCollection: (paperId: string, collectionId: string) => Promise<void>;

  // Tag actions
  loadTags: () => Promise<void>;
  createTag: (name: string, color: string) => Promise<Tag>;
  updateTag: (id: string, name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  addTagToPaper: (paperId: string, tagId: string) => Promise<void>;
  removeTagFromPaper: (paperId: string, tagId: string) => Promise<void>;
}

export const usePaperStore = create<PaperState>((set, get) => ({
  papers: [],
  selectedLibraryPaper: null,
  collections: [],
  tags: [],
  libraryPaperIds: new Set(),
  loading: false,

  // --- Papers ---

  loadPapers: async (filter) => {
    set({ loading: true });
    const papers = await window.electronAPI.getPapers(filter);
    set({ papers, loading: false });
  },

  savePaper: async (paper) => {
    const result = await window.electronAPI.savePaper(paper);
    if (result.success) {
      set((state) => ({
        libraryPaperIds: new Set([...state.libraryPaperIds, paper.id]),
      }));
    }
    return result;
  },

  deletePaper: async (id) => {
    await window.electronAPI.deletePaper(id);
    set((state) => ({
      papers: state.papers.filter((p) => p.id !== id),
      selectedLibraryPaper: state.selectedLibraryPaper?.id === id ? null : state.selectedLibraryPaper,
    }));
  },

  toggleFavorite: async (id) => {
    const isFavorite = await window.electronAPI.toggleFavorite(id);
    set((state) => ({
      papers: state.papers.map((p) => (p.id === id ? { ...p, isFavorite } : p)),
      selectedLibraryPaper:
        state.selectedLibraryPaper?.id === id
          ? { ...state.selectedLibraryPaper, isFavorite }
          : state.selectedLibraryPaper,
    }));
  },

  setSelectedLibraryPaper: (paper) => set({ selectedLibraryPaper: paper }),

  checkPapersInLibrary: async (arxivIds) => {
    const inLibrary = await window.electronAPI.checkPapersInLibrary(arxivIds);
    set({ libraryPaperIds: new Set(inLibrary) });
  },

  searchLibrary: async (query) => {
    set({ loading: true });
    const papers = await window.electronAPI.searchLibrary(query);
    set({ papers, loading: false });
  },

  // --- Collections ---

  loadCollections: async () => {
    const collections = await window.electronAPI.getCollections();
    set({ collections });
  },

  createCollection: async (name, color) => {
    const collection = await window.electronAPI.createCollection(name, color);
    set((state) => ({ collections: [...state.collections, collection] }));
    return collection;
  },

  updateCollection: async (id, name, color) => {
    const updated = await window.electronAPI.updateCollection(id, name, color);
    set((state) => ({
      collections: state.collections.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCollection: async (id) => {
    await window.electronAPI.deleteCollection(id);
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
    }));
  },

  addPaperToCollection: async (paperId, collectionId) => {
    await window.electronAPI.addPaperToCollection(paperId, collectionId);
    // Refresh the selected paper's collections
    const { selectedLibraryPaper } = get();
    if (selectedLibraryPaper?.id === paperId) {
      const paper = await window.electronAPI.getPaper(paperId);
      if (paper) set({ selectedLibraryPaper: paper });
    }
    await get().loadCollections();
  },

  removePaperFromCollection: async (paperId, collectionId) => {
    await window.electronAPI.removePaperFromCollection(paperId, collectionId);
    const { selectedLibraryPaper } = get();
    if (selectedLibraryPaper?.id === paperId) {
      const paper = await window.electronAPI.getPaper(paperId);
      if (paper) set({ selectedLibraryPaper: paper });
    }
    await get().loadCollections();
  },

  // --- Tags ---

  loadTags: async () => {
    const tags = await window.electronAPI.getTags();
    set({ tags });
  },

  createTag: async (name, color) => {
    const tag = await window.electronAPI.createTag(name, color);
    set((state) => ({ tags: [...state.tags, tag] }));
    return tag;
  },

  updateTag: async (id, name, color) => {
    const updated = await window.electronAPI.updateTag(id, name, color);
    set((state) => ({
      tags: state.tags.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTag: async (id) => {
    await window.electronAPI.deleteTag(id);
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
    }));
  },

  addTagToPaper: async (paperId, tagId) => {
    await window.electronAPI.addTagToPaper(paperId, tagId);
    const { selectedLibraryPaper } = get();
    if (selectedLibraryPaper?.id === paperId) {
      const paper = await window.electronAPI.getPaper(paperId);
      if (paper) set({ selectedLibraryPaper: paper });
    }
    await get().loadTags();
  },

  removeTagFromPaper: async (paperId, tagId) => {
    await window.electronAPI.removeTagFromPaper(paperId, tagId);
    const { selectedLibraryPaper } = get();
    if (selectedLibraryPaper?.id === paperId) {
      const paper = await window.electronAPI.getPaper(paperId);
      if (paper) set({ selectedLibraryPaper: paper });
    }
    await get().loadTags();
  },
}));
