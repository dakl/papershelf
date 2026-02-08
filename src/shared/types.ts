export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  publishedDate: string;
  updatedDate: string;
  categories: string[];
  arxivUrl: string;
  pdfUrl: string;
}

export interface LibraryPaper {
  id: string;
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  publishedDate: string;
  updatedDate: string;
  categories: string[];
  arxivUrl: string;
  pdfUrl: string;
  pdfPath: string | null;
  fullText: string | null;
  isFavorite: boolean;
  createdAt: string;
  collections: Collection[];
  tags: Tag[];
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  paperCount: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  paperCount: number;
  createdAt: string;
}

export interface PaperFilter {
  view: 'all-papers' | 'favorites' | 'recent' | 'collection' | 'tag';
  collectionId?: string;
  tagId?: string;
}

export interface SavePaperResult {
  success: boolean;
  paper?: LibraryPaper;
  error?: string;
}

export interface ElectronAPI {
  // ArXiv search
  searchArxiv: (query: string) => Promise<ArxivPaper[]>;

  // Library papers
  savePaper: (paper: ArxivPaper) => Promise<SavePaperResult>;
  getPapers: (filter: PaperFilter) => Promise<LibraryPaper[]>;
  getPaper: (id: string) => Promise<LibraryPaper | null>;
  deletePaper: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  checkPapersInLibrary: (arxivIds: string[]) => Promise<string[]>;
  searchLibrary: (query: string) => Promise<LibraryPaper[]>;

  // Collections
  getCollections: () => Promise<Collection[]>;
  createCollection: (name: string, color: string) => Promise<Collection>;
  updateCollection: (id: string, name: string, color: string) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  addPaperToCollection: (paperId: string, collectionId: string) => Promise<void>;
  removePaperFromCollection: (paperId: string, collectionId: string) => Promise<void>;
  getPaperCollections: (paperId: string) => Promise<Collection[]>;

  // Tags
  getTags: () => Promise<Tag[]>;
  createTag: (name: string, color: string) => Promise<Tag>;
  updateTag: (id: string, name: string, color: string) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  addTagToPaper: (paperId: string, tagId: string) => Promise<void>;
  removeTagFromPaper: (paperId: string, tagId: string) => Promise<void>;
  getPaperTags: (paperId: string) => Promise<Tag[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
