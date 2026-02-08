import { ipcMain } from 'electron';
import { searchArxiv } from './arxiv-client';
import { downloadAndExtractPdf } from './pdf-processor';
import type { ArxivPaper, PaperFilter, SavePaperResult } from '../shared/types';
import * as db from './database';

export function registerIpcHandlers(): void {
  // --- ArXiv ---
  ipcMain.handle('arxiv:search', async (_event, query: string) => {
    return searchArxiv(query);
  });

  // --- Papers ---
  ipcMain.handle('papers:save', async (_event, paper: ArxivPaper): Promise<SavePaperResult> => {
    try {
      const existing = db.getPaperByArxivId(paper.id);
      if (existing) {
        return { success: true, paper: existing };
      }

      let pdfPath: string | null = null;
      let fullText: string | null = null;

      if (paper.pdfUrl) {
        try {
          const result = await downloadAndExtractPdf(paper.pdfUrl, paper.id);
          pdfPath = result.pdfPath;
          fullText = result.fullText;
        } catch {
          // Save paper even if PDF download fails
        }
      }

      const saved = db.insertPaper({
        arxivId: paper.id,
        title: paper.title,
        authors: paper.authors,
        abstract: paper.abstract,
        publishedDate: paper.publishedDate,
        updatedDate: paper.updatedDate,
        categories: paper.categories,
        arxivUrl: paper.arxivUrl,
        pdfUrl: paper.pdfUrl,
        pdfPath,
        fullText,
      });

      return { success: true, paper: saved };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save paper' };
    }
  });

  ipcMain.handle('papers:list', (_event, filter: PaperFilter) => {
    return db.getPapers(filter);
  });

  ipcMain.handle('papers:get', (_event, id: string) => {
    return db.getPaperById(id);
  });

  ipcMain.handle('papers:delete', (_event, id: string) => {
    db.deletePaper(id);
  });

  ipcMain.handle('papers:toggleFavorite', (_event, id: string) => {
    return db.toggleFavorite(id);
  });

  ipcMain.handle('papers:checkInLibrary', (_event, arxivIds: string[]) => {
    return db.checkPapersInLibrary(arxivIds);
  });

  ipcMain.handle('papers:search', (_event, query: string) => {
    return db.searchLibrary(query);
  });

  // --- Collections ---
  ipcMain.handle('collections:list', () => {
    return db.getCollections();
  });

  ipcMain.handle('collections:create', (_event, name: string, color: string) => {
    return db.createCollection(name, color);
  });

  ipcMain.handle('collections:update', (_event, id: string, name: string, color: string) => {
    return db.updateCollection(id, name, color);
  });

  ipcMain.handle('collections:delete', (_event, id: string) => {
    db.deleteCollection(id);
  });

  ipcMain.handle('collections:addPaper', (_event, paperId: string, collectionId: string) => {
    db.addPaperToCollection(paperId, collectionId);
  });

  ipcMain.handle('collections:removePaper', (_event, paperId: string, collectionId: string) => {
    db.removePaperFromCollection(paperId, collectionId);
  });

  ipcMain.handle('collections:forPaper', (_event, paperId: string) => {
    return db.getCollectionsForPaper(paperId);
  });

  // --- Tags ---
  ipcMain.handle('tags:list', () => {
    return db.getTags();
  });

  ipcMain.handle('tags:create', (_event, name: string, color: string) => {
    return db.createTag(name, color);
  });

  ipcMain.handle('tags:update', (_event, id: string, name: string, color: string) => {
    return db.updateTag(id, name, color);
  });

  ipcMain.handle('tags:delete', (_event, id: string) => {
    db.deleteTag(id);
  });

  ipcMain.handle('tags:addToPaper', (_event, paperId: string, tagId: string) => {
    db.addTagToPaper(paperId, tagId);
  });

  ipcMain.handle('tags:removeFromPaper', (_event, paperId: string, tagId: string) => {
    db.removeTagFromPaper(paperId, tagId);
  });

  ipcMain.handle('tags:forPaper', (_event, paperId: string) => {
    return db.getTagsForPaper(paperId);
  });
}
