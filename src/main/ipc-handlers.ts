import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import type {
  ArxivPaper,
  HighlightAnnotation,
  ImportBatchResult,
  PaperFilter,
  PaperMetadataUpdate,
  PdfLibraryPathResult,
  SavePaperResult,
  StickyNoteAnnotation,
  ToolNotificationMode,
} from '../shared/types';
import { searchArxiv } from './arxiv-client';

import * as db from './database';
import { DataChangeEvent, eventEmitter } from './event-emitter';
import {
  getMcpHttpServerStatus,
  restartMcpHttpServerIfRunning,
  startMcpHttpServer,
  stopMcpHttpServer,
} from './mcp/http-server';
import { getDisabledTools, getToolModes, setDisabledTools, setMcpServerEnabled, setToolMode } from './mcp/tool-config';
import { TOOL_METADATA } from './mcp/tools';
import { fetchAndCachePdf, getDefaultPapersDir } from './pdf-processor';
import { embedQuery } from './services/embedding-service';
import { importLocalPdfs } from './services/import-pdf';
import { indexAllPapers, indexPaper } from './services/indexing-service';
import {
  addHighlightAnnotation,
  addStickyNoteAnnotation,
  listAnnotations,
  removeAnnotation,
} from './services/pdf-annotator';
import { readPdfForPaper } from './services/pdf-reader';
import { resolveMetadata, resolveMetadataForPapers } from './services/resolve-metadata';
import { savePaperFromArxivPaper } from './services/save-paper';
import { getPdfLibraryPath, getShortcutOverrides, saveShortcutOverrides, setPdfLibraryPath } from './settings';

export function registerIpcHandlers(): void {
  // --- App ---
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('app:getInfo', () => {
    const stats = db.getLibraryStats();
    return {
      name: app.getName(),
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      stats,
    };
  });

  // --- ArXiv ---
  ipcMain.handle('arxiv:search', async (_event, query: string) => {
    return searchArxiv(query);
  });

  // --- Papers ---
  ipcMain.handle('papers:save', async (_event, paper: ArxivPaper): Promise<SavePaperResult> => {
    try {
      const result = await savePaperFromArxivPaper(paper);
      return {
        success: true,
        paper: result.paper,
        pdfDownloaded: result.pdfDownloaded,
        alreadyExisted: result.alreadyExisted,
      };
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

  ipcMain.handle('papers:delete', async (_event, id: string) => {
    try {
      const paper = db.getPaperById(id);
      if (paper?.pdfPath) {
        const window = BrowserWindow.getFocusedWindow();
        if (window) {
          const result = await dialog.showMessageBox(window, {
            type: 'question',
            buttons: ['Keep PDF', 'Delete PDF'],
            defaultId: 0,
            title: 'Delete Paper',
            message: 'Also delete the PDF file from disk?',
          });
          if (result.response === 1) {
            try {
              fs.unlinkSync(paper.pdfPath);
            } catch {
              // File may not exist
            }
          }
        }
      }
      db.deletePaper(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete paper' };
    }
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

  ipcMain.handle('papers:getPdf', (_event, paperId: string) => {
    return readPdfForPaper(paperId);
  });

  ipcMain.handle('papers:fetchPdfByUrl', async (_event, url: string, arxivId: string) => {
    try {
      return await fetchAndCachePdf(url, arxivId);
    } catch {
      return null;
    }
  });

  ipcMain.handle('papers:importLocal', async (): Promise<ImportBatchResult> => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return { imported: [], failed: [], totalCount: 0 };

    const result = await dialog.showOpenDialog(window, {
      title: 'Import PDFs',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { imported: [], failed: [], totalCount: 0 };
    }

    const importResult = await importLocalPdfs(result.filePaths);

    // Fire-and-forget background metadata resolution for imported papers
    if (importResult.imported.length > 0) {
      const localPapers = importResult.imported
        .filter((p) => p.source === 'local')
        .map((p) => ({ id: p.id, title: p.title }));
      if (localPapers.length > 0) {
        resolveMetadataForPapers(localPapers).catch((err) => {
          console.warn('Background metadata resolution failed:', err);
        });
      }
    }

    return importResult;
  });

  ipcMain.handle('papers:updateMetadata', (_event, id: string, updates: PaperMetadataUpdate) => {
    return db.updatePaperMetadata(id, updates);
  });

  ipcMain.handle('papers:resolveMetadata', async (_event, paperId: string) => {
    const paper = db.getPaperById(paperId);
    if (!paper) return { success: false, error: 'Paper not found' };
    try {
      const resolved = await resolveMetadata(paper.title);
      if (!resolved) return { success: false, error: 'No match found' };
      db.updatePaperMetadata(paperId, resolved.updates);
      return { success: true, source: resolved.source };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Resolution failed' };
    }
  });

  // --- Semantic Search & Indexing ---
  ipcMain.handle('search:semantic', async (_event, query: string) => {
    try {
      const queryEmbedding = await embedQuery(query);
      return db.hybridSearch(query, queryEmbedding);
    } catch {
      // Fallback to FTS-only on embedding failure
      const papers = db.searchLibrary(query);
      return papers.map((paper) => ({ paper, score: 1, matchType: 'keyword' as const }));
    }
  });

  ipcMain.handle('indexing:stats', () => {
    return db.getIndexingStatsFromDb();
  });

  ipcMain.handle('indexing:reindexAll', () => {
    indexAllPapers().catch((err) => {
      console.warn('Reindex all failed:', err);
    });
  });

  ipcMain.handle('indexing:reindexPaper', async (_event, paperId: string) => {
    await indexPaper(paperId);
  });

  // --- Collections ---
  ipcMain.handle('collections:list', () => {
    return db.getCollections();
  });

  ipcMain.handle('collections:create', (_event, name: string, color: string) => {
    try {
      return db.createCollection(name, color);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create collection');
    }
  });

  ipcMain.handle('collections:update', (_event, id: string, name: string, color: string) => {
    try {
      return db.updateCollection(id, name, color);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update collection');
    }
  });

  ipcMain.handle('collections:delete', (_event, id: string) => {
    try {
      db.deleteCollection(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete collection' };
    }
  });

  ipcMain.handle('collections:addPaper', (_event, paperId: string, collectionId: string) => {
    try {
      db.addPaperToCollection(paperId, collectionId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add paper to collection' };
    }
  });

  ipcMain.handle('collections:removePaper', (_event, paperId: string, collectionId: string) => {
    try {
      db.removePaperFromCollection(paperId, collectionId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to remove paper from collection' };
    }
  });

  ipcMain.handle('collections:forPaper', (_event, paperId: string) => {
    return db.getCollectionsForPaper(paperId);
  });

  // --- Tags ---
  ipcMain.handle('tags:list', () => {
    return db.getTags();
  });

  ipcMain.handle('tags:create', (_event, name: string, color: string) => {
    try {
      return db.createTag(name, color);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create tag');
    }
  });

  ipcMain.handle('tags:update', (_event, id: string, name: string, color: string) => {
    try {
      return db.updateTag(id, name, color);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update tag');
    }
  });

  ipcMain.handle('tags:delete', (_event, id: string) => {
    try {
      db.deleteTag(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete tag' };
    }
  });

  ipcMain.handle('tags:addToPaper', (_event, paperId: string, tagId: string) => {
    try {
      db.addTagToPaper(paperId, tagId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add tag to paper' };
    }
  });

  ipcMain.handle('tags:removeFromPaper', (_event, paperId: string, tagId: string) => {
    try {
      db.removeTagFromPaper(paperId, tagId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to remove tag from paper' };
    }
  });

  ipcMain.handle('tags:forPaper', (_event, paperId: string) => {
    return db.getTagsForPaper(paperId);
  });

  // --- Annotations ---
  ipcMain.handle('annotations:list', async (_event, paperId: string, pageIndex: number) => {
    try {
      const paper = db.getPaperById(paperId);
      if (!paper?.pdfPath) return [];
      return await listAnnotations(paper.pdfPath, pageIndex);
    } catch {
      return [];
    }
  });

  ipcMain.handle('annotations:addHighlight', async (_event, annotation: HighlightAnnotation) => {
    try {
      const paper = db.getPaperById(annotation.paperId);
      if (!paper?.pdfPath) return { success: false, error: 'Paper has no PDF' };
      await addHighlightAnnotation(paper.pdfPath, annotation.pageIndex, annotation.quadPoints, annotation.color);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add highlight' };
    }
  });

  ipcMain.handle('annotations:addStickyNote', async (_event, annotation: StickyNoteAnnotation) => {
    try {
      const paper = db.getPaperById(annotation.paperId);
      if (!paper?.pdfPath) return { success: false, error: 'Paper has no PDF' };
      await addStickyNoteAnnotation(
        paper.pdfPath,
        annotation.pageIndex,
        annotation.x,
        annotation.y,
        annotation.text,
        annotation.color,
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add sticky note' };
    }
  });

  ipcMain.handle('annotations:remove', async (_event, paperId: string, pageIndex: number, annotationName: string) => {
    try {
      const paper = db.getPaperById(paperId);
      if (!paper?.pdfPath) return { success: false, error: 'Paper has no PDF' };
      await removeAnnotation(paper.pdfPath, pageIndex, annotationName);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to remove annotation' };
    }
  });

  // --- MCP Server ---
  ipcMain.handle('mcp:getStatus', () => {
    return getMcpHttpServerStatus();
  });

  ipcMain.handle('mcp:start', async (_event, port: number) => {
    await startMcpHttpServer(port);
    setMcpServerEnabled(true);
  });

  ipcMain.handle('mcp:stop', async () => {
    await stopMcpHttpServer();
    setMcpServerEnabled(false);
  });

  ipcMain.handle('mcp:getTools', () => {
    const disabled = new Set(getDisabledTools());
    const modes = getToolModes();
    return TOOL_METADATA.map((tool) => ({
      name: tool.name,
      description: tool.description,
      enabled: !disabled.has(tool.name),
      mode: modes[tool.name] ?? 'notify',
    }));
  });

  ipcMain.handle('mcp:getToolStats', () => {
    return db.getToolStats();
  });

  ipcMain.handle('mcp:setToolEnabled', async (_event, toolName: string, enabled: boolean) => {
    const disabled = new Set(getDisabledTools());
    if (enabled) {
      disabled.delete(toolName);
    } else {
      disabled.add(toolName);
    }
    setDisabledTools([...disabled]);
    await restartMcpHttpServerIfRunning();
  });

  ipcMain.handle('mcp:setToolMode', async (_event, toolName: string, mode: ToolNotificationMode) => {
    setToolMode(toolName, mode);
    await restartMcpHttpServerIfRunning();
  });

  // --- Viewer State ---

  ipcMain.handle('viewerState:get', (_event, paperId: string) => {
    return db.getViewerState(paperId);
  });

  ipcMain.handle(
    'viewerState:save',
    (_event, paperId: string, scale: number, scrollTop: number, scrollLeft: number) => {
      try {
        db.saveViewerState(paperId, scale, scrollTop, scrollLeft);
      } catch (err) {
        console.warn('Failed to save viewer state:', err);
      }
    },
  );

  // --- Settings ---

  ipcMain.handle('settings:getShortcuts', () => {
    return getShortcutOverrides();
  });

  ipcMain.handle('settings:saveShortcuts', (_event, overrides: Record<string, string>) => {
    saveShortcutOverrides(overrides);
  });

  ipcMain.handle('settings:getPdfLibraryPath', () => {
    return getPdfLibraryPath();
  });

  ipcMain.handle('settings:setPdfLibraryPath', async (): Promise<PdfLibraryPathResult> => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return { path: null, cancelled: true };

    const result = await dialog.showOpenDialog(window, {
      title: 'Choose PDF Library Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { path: getPdfLibraryPath(), cancelled: true };
    }

    const newPath = result.filePaths[0];
    setPdfLibraryPath(newPath);

    // Move PDFs that aren't already in the target folder
    let movedCount = 0;
    const papers = db.getAllPaperPdfPaths();
    for (const paper of papers) {
      if (!paper.pdfPath.startsWith(newPath)) {
        const filename = path.basename(paper.pdfPath);
        const newPdfPath = path.join(newPath, filename);
        try {
          if (fs.existsSync(paper.pdfPath) && !fs.existsSync(newPdfPath)) {
            fs.copyFileSync(paper.pdfPath, newPdfPath);
            fs.unlinkSync(paper.pdfPath);
          }
          db.updatePaperPdfPath(paper.id, newPdfPath);
          movedCount++;
        } catch (err) {
          console.warn(`Failed to move PDF ${paper.pdfPath}:`, err);
        }
      }
    }

    return { path: newPath, cancelled: false, movedCount };
  });

  ipcMain.handle('settings:resetPdfLibraryPath', () => {
    const defaultPath = getDefaultPapersDir();
    setPdfLibraryPath(null);

    // Move PDFs not already in the default folder back to it
    const papers = db.getAllPaperPdfPaths();
    for (const paper of papers) {
      if (!paper.pdfPath.startsWith(defaultPath)) {
        const filename = path.basename(paper.pdfPath);
        const newPdfPath = path.join(defaultPath, filename);
        try {
          if (fs.existsSync(paper.pdfPath) && !fs.existsSync(newPdfPath)) {
            fs.copyFileSync(paper.pdfPath, newPdfPath);
            fs.unlinkSync(paper.pdfPath);
          }
          db.updatePaperPdfPath(paper.id, newPdfPath);
        } catch (err) {
          console.warn(`Failed to move PDF ${paper.pdfPath}:`, err);
        }
      }
    }
  });

  // Setup event forwarding from main process to renderer
  eventEmitter.on(DataChangeEvent.COLLECTIONS_CHANGED, () => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('data:collections-changed');
    });
  });

  eventEmitter.on(DataChangeEvent.TAGS_CHANGED, () => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('data:tags-changed');
    });
  });

  eventEmitter.on(DataChangeEvent.PAPERS_CHANGED, () => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('data:papers-changed');
    });
  });

  eventEmitter.on(DataChangeEvent.ANNOTATIONS_CHANGED, () => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('data:annotations-changed');
    });
  });

  eventEmitter.on(DataChangeEvent.IMPORT_PROGRESS, (progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('data:import-progress', progress);
    });
  });

  eventEmitter.on(DataChangeEvent.METADATA_RESOLUTION_PROGRESS, (progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('data:metadata-resolution-progress', progress);
    });
  });

  eventEmitter.on(DataChangeEvent.EMBEDDING_PROGRESS, (progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('data:embedding-progress', progress);
    });
  });

  eventEmitter.on(DataChangeEvent.INDEXING_PROGRESS, (progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('data:indexing-progress', progress);
    });
  });
}
