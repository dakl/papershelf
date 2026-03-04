export {
  addPaperToCollection,
  createCollection,
  deleteCollection,
  getCollectionByName,
  getCollections,
  getCollectionsForPaper,
  getCollectionsForPapers,
  removePaperFromCollection,
  updateCollection,
} from './collections';
export { closeDatabase, initDatabase } from './connection';
export type { SemanticSearchResult } from './hybrid-search';
export { hybridSearch } from './hybrid-search';
export type { LibraryStats } from './papers';
export {
  checkPapersInLibrary,
  deletePaper,
  getAllPaperPdfPaths,
  getLibraryStats,
  getPaperByArxivId,
  getPaperById,
  getPapers,
  insertPaper,
  searchLibrary,
  toggleFavorite,
  updatePaperMetadata,
  updatePaperPdf,
  updatePaperPdfPath,
} from './papers';
export {
  addTagToPaper,
  createTag,
  deleteTag,
  getTagByName,
  getTags,
  getTagsForPaper,
  getTagsForPapers,
  removeTagFromPaper,
  updateTag,
} from './tags';
export { getToolStats, logToolCall } from './tool-stats';
export type { ChunkInsertData, EmbeddingStatusValue, IndexingStats, VectorSearchResult } from './vector-store';
export {
  deleteChunksForPaper,
  getIndexingStats,
  getIndexingStatsFromDb,
  getPapersNeedingEmbedding,
  insertChunkWithEmbedding,
  setEmbeddingStatus,
  vectorSearch,
} from './vector-store';
export { getViewerState, saveViewerState } from './viewer-state';
