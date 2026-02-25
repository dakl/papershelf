import { create } from 'zustand';
import type {
  ArxivPaper,
  Collection,
  ImportBatchResult,
  ImportProgress,
  LibraryPaper,
  PaperFilter,
  PaperMetadataUpdate,
  SavePaperResult,
  Tag,
} from '../../shared/types';
import { toast } from './toastStore';

interface LibraryStats {
  paperCount: number;
  favoriteCount: number;
}

interface PaperState {
  papers: LibraryPaper[];
  selectedLibraryPaper: LibraryPaper | null;
  collections: Collection[];
  tags: Tag[];
  libraryPaperIds: Set<string>;
  libraryStats: LibraryStats | null;
  loading: boolean;
  importProgress: ImportProgress | null;
  resolvingPaperIds: Set<string>;

  // Paper actions
  loadPapers: (filter: PaperFilter) => Promise<void>;
  savePaper: (paper: ArxivPaper) => Promise<SavePaperResult>;
  deletePaper: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setSelectedLibraryPaper: (paper: LibraryPaper | null) => void;
  checkPapersInLibrary: (arxivIds: string[]) => Promise<void>;
  searchLibrary: (query: string) => Promise<void>;
  importLocalPdfs: () => Promise<ImportBatchResult>;
  importFiles: (filePaths: string[]) => Promise<ImportBatchResult>;
  updatePaperMetadata: (id: string, updates: PaperMetadataUpdate) => Promise<void>;
  resolveMetadata: (paperId: string) => Promise<void>;
  loadLibraryStats: () => Promise<void>;

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

async function runImport(
  apiCall: () => Promise<ImportBatchResult>,
  set: (partial: Partial<PaperState>) => void,
  get: () => PaperState,
): Promise<ImportBatchResult> {
  const unsubscribe = window.electronAPI.onImportProgress((progress) => {
    set({ importProgress: progress });
  });
  const result = await apiCall();
  unsubscribe();
  set({ importProgress: null });
  if (result.totalCount === 0) return result;

  if (result.imported.length > 0) {
    get().loadLibraryStats();
    const msg =
      result.failed.length > 0
        ? `Imported ${result.imported.length} of ${result.totalCount} PDFs (${result.failed.length} failed)`
        : `Imported ${result.imported.length} PDF${result.imported.length === 1 ? '' : 's'}`;
    toast(msg, result.failed.length > 0 ? 'error' : 'success');
  } else {
    toast(`Failed to import ${result.failed.length} PDF${result.failed.length === 1 ? '' : 's'}`, 'error');
  }

  return result;
}

export const usePaperStore = create<PaperState>((set, get) => ({
  papers: [],
  selectedLibraryPaper: null,
  collections: [],
  tags: [],
  libraryPaperIds: new Set(),
  libraryStats: null,
  loading: false,
  importProgress: null,
  resolvingPaperIds: new Set(),

  // --- Stats ---

  loadLibraryStats: async () => {
    const info = await window.electronAPI.getAppInfo();
    set({ libraryStats: { paperCount: info.stats.paperCount, favoriteCount: info.stats.favoriteCount } });
  },

  // --- Papers ---

  loadPapers: async (filter) => {
    const isInitialLoad = get().papers.length === 0;
    if (isInitialLoad) set({ loading: true });
    const papers = await window.electronAPI.getPapers(filter);
    set({ papers, loading: false });
  },

  savePaper: async (paper) => {
    const result = await window.electronAPI.savePaper(paper);
    if (result.success) {
      set((state) => ({
        libraryPaperIds: new Set([...state.libraryPaperIds, paper.id]),
      }));
      get().loadLibraryStats();
    }
    return result;
  },

  deletePaper: async (id) => {
    try {
      await window.electronAPI.deletePaper(id);
      set((state) => ({
        papers: state.papers.filter((p) => p.id !== id),
        selectedLibraryPaper: state.selectedLibraryPaper?.id === id ? null : state.selectedLibraryPaper,
      }));
      get().loadLibraryStats();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete paper', 'error');
      throw err;
    }
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
    get().loadLibraryStats();
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

  importLocalPdfs: async () => {
    return runImport(() => window.electronAPI.importLocalPdfs(), set, get);
  },

  importFiles: async (filePaths) => {
    return runImport(() => window.electronAPI.importFiles(filePaths), set, get);
  },

  updatePaperMetadata: async (id, updates) => {
    try {
      const updated = await window.electronAPI.updatePaperMetadata(id, updates);
      set((state) => ({
        papers: state.papers.map((p) => (p.id === id ? updated : p)),
        selectedLibraryPaper: state.selectedLibraryPaper?.id === id ? updated : state.selectedLibraryPaper,
      }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update paper', 'error');
      throw err;
    }
  },

  resolveMetadata: async (paperId) => {
    set((state) => ({
      resolvingPaperIds: new Set([...state.resolvingPaperIds, paperId]),
    }));
    try {
      const result = await window.electronAPI.resolveMetadata(paperId);
      if (result.success) {
        toast(`Metadata resolved via ${result.source}`, 'success');
      } else {
        toast(result.error ?? 'No metadata found', 'info');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Resolution failed', 'error');
    } finally {
      set((state) => {
        const next = new Set(state.resolvingPaperIds);
        next.delete(paperId);
        return { resolvingPaperIds: next };
      });
    }
  },

  // --- Collections ---

  loadCollections: async () => {
    const collections = await window.electronAPI.getCollections();
    set({ collections });
  },

  createCollection: async (name, color) => {
    try {
      const collection = await window.electronAPI.createCollection(name, color);
      set((state) => ({ collections: [...state.collections, collection] }));
      return collection;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create collection', 'error');
      throw err;
    }
  },

  updateCollection: async (id, name, color) => {
    try {
      const updated = await window.electronAPI.updateCollection(id, name, color);
      set((state) => ({
        collections: state.collections.map((c) => (c.id === id ? updated : c)),
      }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update collection', 'error');
      throw err;
    }
  },

  deleteCollection: async (id) => {
    try {
      await window.electronAPI.deleteCollection(id);
      set((state) => ({
        collections: state.collections.filter((c) => c.id !== id),
      }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete collection', 'error');
      throw err;
    }
  },

  addPaperToCollection: async (paperId, collectionId) => {
    const result = await window.electronAPI.addPaperToCollection(paperId, collectionId);
    if (result && !result.success) {
      toast(result.error ?? 'Failed to add paper to collection', 'error');
      return;
    }
    const { selectedLibraryPaper } = get();
    if (selectedLibraryPaper?.id === paperId) {
      const paper = await window.electronAPI.getPaper(paperId);
      if (paper) set({ selectedLibraryPaper: paper });
    }
    await get().loadCollections();
  },

  removePaperFromCollection: async (paperId, collectionId) => {
    const result = await window.electronAPI.removePaperFromCollection(paperId, collectionId);
    if (result && !result.success) {
      toast(result.error ?? 'Failed to remove paper from collection', 'error');
      return;
    }
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
    try {
      const tag = await window.electronAPI.createTag(name, color);
      set((state) => ({ tags: [...state.tags, tag] }));
      return tag;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create tag', 'error');
      throw err;
    }
  },

  updateTag: async (id, name, color) => {
    try {
      const updated = await window.electronAPI.updateTag(id, name, color);
      set((state) => ({
        tags: state.tags.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update tag', 'error');
      throw err;
    }
  },

  deleteTag: async (id) => {
    try {
      await window.electronAPI.deleteTag(id);
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
      }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete tag', 'error');
      throw err;
    }
  },

  addTagToPaper: async (paperId, tagId) => {
    const result = await window.electronAPI.addTagToPaper(paperId, tagId);
    if (result && !result.success) {
      toast(result.error ?? 'Failed to add tag to paper', 'error');
      return;
    }
    const { selectedLibraryPaper } = get();
    if (selectedLibraryPaper?.id === paperId) {
      const paper = await window.electronAPI.getPaper(paperId);
      if (paper) set({ selectedLibraryPaper: paper });
    }
    await get().loadTags();
  },

  removeTagFromPaper: async (paperId, tagId) => {
    const result = await window.electronAPI.removeTagFromPaper(paperId, tagId);
    if (result && !result.success) {
      toast(result.error ?? 'Failed to remove tag from paper', 'error');
      return;
    }
    const { selectedLibraryPaper } = get();
    if (selectedLibraryPaper?.id === paperId) {
      const paper = await window.electronAPI.getPaper(paperId);
      if (paper) set({ selectedLibraryPaper: paper });
    }
    await get().loadTags();
  },
}));
