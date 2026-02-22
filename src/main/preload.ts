import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';

const api: ElectronAPI = {
  // App info
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  onShowAbout: (callback: () => void) => {
    ipcRenderer.on('app:showAbout', callback);
    return () => {
      ipcRenderer.removeListener('app:showAbout', callback);
    };
  },

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
  importLocalPdfs: () => ipcRenderer.invoke('papers:importLocal'),
  updatePaperMetadata: (id, updates) => ipcRenderer.invoke('papers:updateMetadata', id, updates),
  resolveMetadata: (paperId) => ipcRenderer.invoke('papers:resolveMetadata', paperId),

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
  getPdfLibraryPath: () => ipcRenderer.invoke('settings:getPdfLibraryPath'),
  setPdfLibraryPath: () => ipcRenderer.invoke('settings:setPdfLibraryPath'),
  resetPdfLibraryPath: () => ipcRenderer.invoke('settings:resetPdfLibraryPath'),

  // MCP Server
  getMcpStatus: () => ipcRenderer.invoke('mcp:getStatus'),
  startMcpServer: (port) => ipcRenderer.invoke('mcp:start', port),
  stopMcpServer: () => ipcRenderer.invoke('mcp:stop'),
  getMcpTools: () => ipcRenderer.invoke('mcp:getTools'),
  setMcpToolEnabled: (toolName, enabled) => ipcRenderer.invoke('mcp:setToolEnabled', toolName, enabled),
  setMcpToolMode: (toolName, mode) => ipcRenderer.invoke('mcp:setToolMode', toolName, mode),
  getToolStats: () => ipcRenderer.invoke('mcp:getToolStats'),

  onMcpToolsChanged: (callback) => {
    ipcRenderer.on('mcp:tools-changed', callback);
    return () => ipcRenderer.removeListener('mcp:tools-changed', callback);
  },

  // Event listeners for data changes
  onCollectionsChanged: (callback) => {
    ipcRenderer.on('data:collections-changed', callback);
    return () => ipcRenderer.removeListener('data:collections-changed', callback);
  },

  onTagsChanged: (callback) => {
    ipcRenderer.on('data:tags-changed', callback);
    return () => ipcRenderer.removeListener('data:tags-changed', callback);
  },

  onPapersChanged: (callback) => {
    ipcRenderer.on('data:papers-changed', callback);
    return () => ipcRenderer.removeListener('data:papers-changed', callback);
  },

  onAnnotationsChanged: (callback) => {
    ipcRenderer.on('data:annotations-changed', callback);
    return () => ipcRenderer.removeListener('data:annotations-changed', callback);
  },

  onImportProgress: (callback) => {
    const handler = (_event: unknown, progress: Parameters<typeof callback>[0]) => callback(progress);
    ipcRenderer.on('data:import-progress', handler);
    return () => ipcRenderer.removeListener('data:import-progress', handler);
  },

  onMetadataResolutionProgress: (callback) => {
    const handler = (_event: unknown, progress: Parameters<typeof callback>[0]) => callback(progress);
    ipcRenderer.on('data:metadata-resolution-progress', handler);
    return () => ipcRenderer.removeListener('data:metadata-resolution-progress', handler);
  },

  // App Updates
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),

  // Auto-update settings
  getAutoUpdateSettings: () => ipcRenderer.invoke('updater:getSettings'),
  setAutoUpdateEnabled: (enabled) => ipcRenderer.invoke('updater:setAutoCheck', enabled),
  setUpdateCheckInterval: (hours) => ipcRenderer.invoke('updater:setInterval', hours),
  startPeriodicUpdateChecks: () => ipcRenderer.invoke('updater:startPeriodicChecks'),
  stopPeriodicUpdateChecks: () => ipcRenderer.invoke('updater:stopPeriodicChecks'),

  // Updater event listeners
  onUpdaterProgress: (callback) => {
    const handler = (_event: unknown, data: Parameters<typeof callback>[0]) => callback(data);
    ipcRenderer.on('updater:progress', handler);
    return () => ipcRenderer.removeListener('updater:progress', handler);
  },
  onUpdaterError: (callback) => {
    const handler = (_event: unknown, data: Parameters<typeof callback>[0]) => callback(data);
    ipcRenderer.on('updater:error', handler);
    return () => ipcRenderer.removeListener('updater:error', handler);
  },
  onUpdaterUpdateDownloaded: (callback) => {
    const handler = (_event: unknown, data: Parameters<typeof callback>[0]) => callback(data);
    ipcRenderer.on('updater:update-downloaded', handler);
    return () => ipcRenderer.removeListener('updater:update-downloaded', handler);
  },
  onUpdateAvailable: (callback) => {
    const handler = (_event: unknown, data: Parameters<typeof callback>[0]) => callback(data);
    ipcRenderer.on('updater:update-available', handler);
    return () => ipcRenderer.removeListener('updater:update-available', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
