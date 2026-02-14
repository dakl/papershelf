import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';

const api: ElectronAPI = {
  // ArXiv search
  searchArxiv: (query) => ipcRenderer.invoke('arxiv:search', query),

  // Library papers
  savePaper: (paper) => ipcRenderer.invoke('papers:save', paper),
  getPapers: (filter) => ipcRenderer.invoke('papers:list', filter),
  getPaper: (id) => ipcRenderer.invoke('papers:get', id),
  getPdf: (paperId) => ipcRenderer.invoke('papers:getPdf', paperId),
  fetchPdfByUrl: (url, arxivId) => ipcRenderer.invoke('papers:fetchPdfByUrl', url, arxivId),
  deletePaper: (id) => ipcRenderer.invoke('papers:delete', id),
  toggleFavorite: (id) => ipcRenderer.invoke('papers:toggleFavorite', id),
  checkPapersInLibrary: (arxivIds) => ipcRenderer.invoke('papers:checkInLibrary', arxivIds),
  searchLibrary: (query) => ipcRenderer.invoke('papers:search', query),

  // Collections
  getCollections: () => ipcRenderer.invoke('collections:list'),
  createCollection: (name, color) => ipcRenderer.invoke('collections:create', name, color),
  updateCollection: (id, name, color) => ipcRenderer.invoke('collections:update', id, name, color),
  deleteCollection: (id) => ipcRenderer.invoke('collections:delete', id),
  addPaperToCollection: (paperId, collectionId) => ipcRenderer.invoke('collections:addPaper', paperId, collectionId),
  removePaperFromCollection: (paperId, collectionId) =>
    ipcRenderer.invoke('collections:removePaper', paperId, collectionId),
  getPaperCollections: (paperId) => ipcRenderer.invoke('collections:forPaper', paperId),

  // Tags
  getTags: () => ipcRenderer.invoke('tags:list'),
  createTag: (name, color) => ipcRenderer.invoke('tags:create', name, color),
  updateTag: (id, name, color) => ipcRenderer.invoke('tags:update', id, name, color),
  deleteTag: (id) => ipcRenderer.invoke('tags:delete', id),
  addTagToPaper: (paperId, tagId) => ipcRenderer.invoke('tags:addToPaper', paperId, tagId),
  removeTagFromPaper: (paperId, tagId) => ipcRenderer.invoke('tags:removeFromPaper', paperId, tagId),
  getPaperTags: (paperId) => ipcRenderer.invoke('tags:forPaper', paperId),

  // Citations
  fetchCitations: (arxivId) => ipcRenderer.invoke('citations:fetch', arxivId),
  fetchCitationsBatch: (arxivIds) => ipcRenderer.invoke('citations:fetchBatch', arxivIds),
  getCitationGraph: () => ipcRenderer.invoke('citations:getGraph'),
  getCitationSubgraph: (seedArxivIds, expandedS2Ids) =>
    ipcRenderer.invoke('citations:getSubgraph', seedArxivIds, expandedS2Ids),
  expandCitationNode: (s2Id) => ipcRenderer.invoke('citations:expandNode', s2Id),

  // Annotations
  listAnnotations: (paperId, pageIndex) => ipcRenderer.invoke('annotations:list', paperId, pageIndex),
  addHighlight: (annotation) => ipcRenderer.invoke('annotations:addHighlight', annotation),
  addStickyNote: (annotation) => ipcRenderer.invoke('annotations:addStickyNote', annotation),
  removeAnnotation: (paperId, pageIndex, annotationName) =>
    ipcRenderer.invoke('annotations:remove', paperId, pageIndex, annotationName),

  // Viewer state
  getViewerState: (paperId) => ipcRenderer.invoke('viewerState:get', paperId),
  saveViewerState: (paperId, scale, scrollTop, scrollLeft) =>
    ipcRenderer.invoke('viewerState:save', paperId, scale, scrollTop, scrollLeft),

  // Settings
  getShortcutOverrides: () => ipcRenderer.invoke('settings:getShortcuts'),
  saveShortcutOverrides: (overrides) => ipcRenderer.invoke('settings:saveShortcuts', overrides),

  // MCP Server
  getMcpStatus: () => ipcRenderer.invoke('mcp:getStatus'),
  startMcpServer: (port) => ipcRenderer.invoke('mcp:start', port),
  stopMcpServer: () => ipcRenderer.invoke('mcp:stop'),
  getMcpTools: () => ipcRenderer.invoke('mcp:getTools'),
  setMcpToolEnabled: (toolName, enabled) => ipcRenderer.invoke('mcp:setToolEnabled', toolName, enabled),
  getToolStats: () => ipcRenderer.invoke('mcp:getToolStats'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
