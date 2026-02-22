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

export type PaperSource = 'arxiv' | 'local';

export interface LibraryPaper {
  id: string;
  arxivId: string | null;
  doi: string | null;
  source: PaperSource;
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

export type SortBy = 'created_at' | 'published_date' | 'title' | 'first_author';
export type SortOrder = 'asc' | 'desc';

export interface PaperFilter {
  view: 'all-papers' | 'favorites' | 'recent' | 'collection' | 'tag';
  collectionId?: string;
  tagId?: string;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}

export interface SavePaperResult {
  success: boolean;
  paper?: LibraryPaper;
  pdfDownloaded?: boolean;
  alreadyExisted?: boolean;
  error?: string;
}

export interface ImportBatchResult {
  imported: LibraryPaper[];
  failed: { filename: string; error: string }[];
  totalCount: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  filename: string;
}

export interface PaperMetadataUpdate {
  title?: string;
  authors?: string[];
  abstract?: string;
  publishedDate?: string;
  doi?: string | null;
  categories?: string[];
}

export type MetadataResolutionStatus = 'resolving' | 'resolved' | 'failed' | 'no-match';

export interface MetadataResolutionProgress {
  paperId: string;
  status: MetadataResolutionStatus;
  source?: string;
}

export interface PdfLibraryPathResult {
  path: string | null;
  cancelled: boolean;
  movedCount?: number;
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
  importLocalPdfs: () => Promise<ImportBatchResult>;
  updatePaperMetadata: (id: string, updates: PaperMetadataUpdate) => Promise<LibraryPaper>;
  resolveMetadata: (paperId: string) => Promise<{ success: boolean; source?: string; error?: string }>;

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
  getPdfLibraryPath: () => Promise<string | null>;
  setPdfLibraryPath: () => Promise<PdfLibraryPathResult>;
  resetPdfLibraryPath: () => Promise<void>;

  // MCP Server
  getMcpStatus: () => Promise<McpServerStatus>;
  startMcpServer: (port: number) => Promise<void>;
  stopMcpServer: () => Promise<void>;
  getMcpTools: () => Promise<McpToolInfo[]>;
  setMcpToolEnabled: (toolName: string, enabled: boolean) => Promise<void>;
  setMcpToolMode: (toolName: string, mode: ToolNotificationMode) => Promise<void>;
  getToolStats: () => Promise<ToolCallStats[]>;

  // App Updates
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{
    available: boolean;
    version?: string;
    releaseNotes?: string;
    error?: string;
  }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstall: () => Promise<void>;

  // Auto-update settings
  getAutoUpdateSettings: () => Promise<{
    autoCheckEnabled: boolean;
    checkIntervalHours: number;
    checkOnStartup: boolean;
  }>;
  setAutoUpdateEnabled: (enabled: boolean) => Promise<void>;
  setUpdateCheckInterval: (hours: number) => Promise<void>;
  startPeriodicUpdateChecks: () => Promise<void>;
  stopPeriodicUpdateChecks: () => Promise<void>;

  // Updater event listeners
  onUpdaterProgress: (
    callback: (progress: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void,
  ) => () => void;
  onUpdaterError: (callback: (error: { error: string }) => void) => () => void;
  onUpdaterUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
  onUpdateAvailable: (callback: (version: string) => void) => () => void;

  // MCP event listeners
  onMcpToolsChanged: (callback: () => void) => () => void;

  // Event listeners for real-time updates
  onCollectionsChanged: (callback: () => void) => () => void;
  onTagsChanged: (callback: () => void) => () => void;
  onPapersChanged: (callback: () => void) => () => void;
  onAnnotationsChanged: (callback: () => void) => () => void;
  onImportProgress: (callback: (progress: ImportProgress) => void) => () => void;
  onMetadataResolutionProgress: (callback: (progress: MetadataResolutionProgress) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
