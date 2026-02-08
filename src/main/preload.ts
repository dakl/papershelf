import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';

const api: ElectronAPI = {
  // ArXiv search
  searchArxiv: (query) => ipcRenderer.invoke('arxiv:search', query),

  // Library papers
  savePaper: (paper) => ipcRenderer.invoke('papers:save', paper),
  getPapers: (filter) => ipcRenderer.invoke('papers:list', filter),
  getPaper: (id) => ipcRenderer.invoke('papers:get', id),
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
  removePaperFromCollection: (paperId, collectionId) => ipcRenderer.invoke('collections:removePaper', paperId, collectionId),
  getPaperCollections: (paperId) => ipcRenderer.invoke('collections:forPaper', paperId),

  // Tags
  getTags: () => ipcRenderer.invoke('tags:list'),
  createTag: (name, color) => ipcRenderer.invoke('tags:create', name, color),
  updateTag: (id, name, color) => ipcRenderer.invoke('tags:update', id, name, color),
  deleteTag: (id) => ipcRenderer.invoke('tags:delete', id),
  addTagToPaper: (paperId, tagId) => ipcRenderer.invoke('tags:addToPaper', paperId, tagId),
  removeTagFromPaper: (paperId, tagId) => ipcRenderer.invoke('tags:removeFromPaper', paperId, tagId),
  getPaperTags: (paperId) => ipcRenderer.invoke('tags:forPaper', paperId),
};

contextBridge.exposeInMainWorld('electronAPI', api);
