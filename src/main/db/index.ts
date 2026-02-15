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
export type { LibraryStats } from './papers';
export {
  checkPapersInLibrary,
  deletePaper,
  getLibraryStats,
  getPaperByArxivId,
  getPaperById,
  getPapers,
  insertPaper,
  searchLibrary,
  toggleFavorite,
  updatePaperPdf,
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
export { getViewerState, saveViewerState } from './viewer-state';
