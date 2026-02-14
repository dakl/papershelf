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

export interface McpServerStatus {
  running: boolean;
  port: number;
}

export type ToolNotificationMode = 'notify' | 'confirm' | 'silent';

export interface McpToolInfo {
  name: string;
  description: string;
  enabled: boolean;
  mode: ToolNotificationMode;
}

export interface ToolCallStats {
  toolName: string;
  totalCalls: number;
  lastCalledAt: string | null;
  errorCount: number;
  averageDurationMs: number;
}

// --- Annotations ---

export interface HighlightAnnotation {
  paperId: string;
  pageIndex: number; // 0-based
  quadPoints: number[]; // [x1,y1, x2,y2, ...] in PDF coordinates, 8 per rect
  color: string; // hex e.g. '#FFEB3B'
}

export interface StickyNoteAnnotation {
  paperId: string;
  pageIndex: number;
  x: number; // PDF coordinates
  y: number;
  text: string;
  color: string;
}

export interface AnnotationEntry {
  nm: string;
  subtype: string;
  rect: number[];
  contents?: string;
}

export interface ViewerState {
  paperId: string;
  scale: number;
  scrollTop: number;
  scrollLeft: number;
}

export interface PaperFilter {
  view: 'all-papers' | 'favorites' | 'recent' | 'collection' | 'tag';
  collectionId?: string;
  tagId?: string;
}

export interface SavePaperResult {
  success: boolean;
  paper?: LibraryPaper;
  pdfDownloaded?: boolean;
  error?: string;
}

// --- Citation Graph ---

export interface CitationNode {
  semanticScholarId: string;
  arxivId: string | null;
  title: string;
  authors: string[];
  year: number | null;
  inLibrary: boolean;
}

export interface CitationEdge {
  source: string; // citing s2 id
  target: string; // cited s2 id
}

export interface CitationGraphData {
  nodes: CitationNode[];
  edges: CitationEdge[];
}

export interface AppInfo {
  name: string;
  version: string;
  electronVersion: string;
  stats: {
    paperCount: number;
    favoriteCount: number;
    collectionCount: number;
    tagCount: number;
  };
}

export interface ElectronAPI {
  // App info
  getAppInfo: () => Promise<AppInfo>;
  onShowAbout: (callback: () => void) => () => void;

  // ArXiv search
  searchArxiv: (query: string) => Promise<ArxivPaper[]>;

  // Library papers
  savePaper: (paper: ArxivPaper) => Promise<SavePaperResult>;
  getPapers: (filter: PaperFilter) => Promise<LibraryPaper[]>;
  getPaper: (id: string) => Promise<LibraryPaper | null>;
  getPdf: (paperId: string) => Promise<ArrayBuffer | null>;
  fetchPdfByUrl: (url: string, arxivId: string) => Promise<ArrayBuffer | null>;
  deletePaper: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  checkPapersInLibrary: (arxivIds: string[]) => Promise<string[]>;
  searchLibrary: (query: string) => Promise<LibraryPaper[]>;

  // Collections
  getCollections: () => Promise<Collection[]>;
  createCollection: (name: string, color: string) => Promise<Collection>;
  updateCollection: (id: string, name: string, color: string) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  addPaperToCollection: (paperId: string, collectionId: string) => Promise<{ success: boolean; error?: string }>;
  removePaperFromCollection: (paperId: string, collectionId: string) => Promise<{ success: boolean; error?: string }>;
  getPaperCollections: (paperId: string) => Promise<Collection[]>;

  // Tags
  getTags: () => Promise<Tag[]>;
  createTag: (name: string, color: string) => Promise<Tag>;
  updateTag: (id: string, name: string, color: string) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  addTagToPaper: (paperId: string, tagId: string) => Promise<{ success: boolean; error?: string }>;
  removeTagFromPaper: (paperId: string, tagId: string) => Promise<{ success: boolean; error?: string }>;
  getPaperTags: (paperId: string) => Promise<Tag[]>;

  // Citations
  fetchCitations: (arxivId: string) => Promise<{ success: boolean; error?: string }>;
  fetchCitationsBatch: (arxivIds: string[]) => Promise<{ fetched: number; failed: number }>;
  getCitationGraph: () => Promise<CitationGraphData>;
  getCitationSubgraph: (seedArxivIds: string[], expandedS2Ids: string[]) => Promise<CitationGraphData>;
  expandCitationNode: (s2Id: string) => Promise<{ success: boolean; error?: string }>;

  // Annotations
  listAnnotations: (paperId: string, pageIndex: number) => Promise<AnnotationEntry[]>;
  addHighlight: (annotation: HighlightAnnotation) => Promise<{ success: boolean; error?: string }>;
  addStickyNote: (annotation: StickyNoteAnnotation) => Promise<{ success: boolean; error?: string }>;
  removeAnnotation: (
    paperId: string,
    pageIndex: number,
    annotationName: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Viewer state
  getViewerState: (paperId: string) => Promise<ViewerState | null>;
  saveViewerState: (paperId: string, scale: number, scrollTop: number, scrollLeft: number) => Promise<void>;

  // Settings
  getShortcutOverrides: () => Promise<Record<string, string>>;
  saveShortcutOverrides: (overrides: Record<string, string>) => Promise<void>;

  // MCP Server
  getMcpStatus: () => Promise<McpServerStatus>;
  startMcpServer: (port: number) => Promise<void>;
  stopMcpServer: () => Promise<void>;
  getMcpTools: () => Promise<McpToolInfo[]>;
  setMcpToolEnabled: (toolName: string, enabled: boolean) => Promise<void>;
  setMcpToolMode: (toolName: string, mode: ToolNotificationMode) => Promise<void>;
  getToolStats: () => Promise<ToolCallStats[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
