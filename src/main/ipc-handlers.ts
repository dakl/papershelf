import { app, ipcMain } from 'electron';
import type {
  ArxivPaper,
  HighlightAnnotation,
  PaperFilter,
  SavePaperResult,
  StickyNoteAnnotation,
  ToolNotificationMode,
} from '../shared/types';
import { searchArxiv } from './arxiv-client';
import { CITATION_CACHE_TTL_DAYS } from './constants';
import * as db from './database';
import { getMcpHttpServerStatus, startMcpHttpServer, stopMcpHttpServer } from './mcp/http-server';
import {
  getDisabledTools,
  getToolModes,
  setDisabledTools,
  setMcpServerEnabled,
  setToolMode,
} from './mcp/tool-config';
import { TOOL_METADATA } from './mcp/tools';
import { fetchAndCachePdf } from './pdf-processor';
import { fetchCitationData, fetchCitationDataByS2Id } from './semantic-scholar/client';
import { isCitationCacheFresh } from './services/citation-cache';
import {
  addHighlightAnnotation,
  addStickyNoteAnnotation,
  listAnnotations,
  removeAnnotation,
} from './services/pdf-annotator';
import { readPdfForPaper } from './services/pdf-reader';
import { savePaperFromArxivPaper } from './services/save-paper';
import { getShortcutOverrides, saveShortcutOverrides } from './settings';

export function registerIpcHandlers(): void {
  // --- App ---
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
      return { success: true, paper: result.paper, pdfDownloaded: result.pdfDownloaded };
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
    try {
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

    // Restart server so new sessions pick up the change
    const status = getMcpHttpServerStatus();
    if (status.running) {
      await stopMcpHttpServer();
      await startMcpHttpServer(status.port);
    }
  });

  ipcMain.handle('mcp:setToolMode', async (_event, toolName: string, mode: ToolNotificationMode) => {
    setToolMode(toolName, mode);

    const status = getMcpHttpServerStatus();
    if (status.running) {
      await stopMcpHttpServer();
      await startMcpHttpServer(status.port);
    }
  });

  // --- Citations ---

  ipcMain.handle('citations:fetch', async (_event, arxivId: string) => {
    try {
      if (isCitationCacheFresh(arxivId, CITATION_CACHE_TTL_DAYS)) {
        return { success: true };
      }

      const data = await fetchCitationData(arxivId);
      if (!data) {
        return { success: false, error: 'Paper not found on Semantic Scholar' };
      }

      db.saveCitationBatch(data.paper, data.references, data.citations, arxivId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch citations' };
    }
  });

  ipcMain.handle('citations:fetchBatch', async (_event, arxivIds: string[]) => {
    let fetched = 0;
    let failed = 0;

    for (const arxivId of arxivIds) {
      try {
        if (isCitationCacheFresh(arxivId, CITATION_CACHE_TTL_DAYS)) {
          fetched++;
          continue;
        }

        const data = await fetchCitationData(arxivId);
        if (data) {
          db.saveCitationBatch(data.paper, data.references, data.citations, arxivId);
          fetched++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { fetched, failed };
  });

  ipcMain.handle('citations:getGraph', () => {
    return db.getCitationGraph();
  });

  ipcMain.handle('citations:getSubgraph', async (_event, seedArxivIds: string[], expandedS2Ids: string[]) => {
    const seedS2Ids = db.getS2IdsByArxivIds(seedArxivIds);
    const allCenterIds = [...new Set([...seedS2Ids, ...expandedS2Ids])];
    return db.getCitationSubgraph(allCenterIds);
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

  ipcMain.handle('citations:expandNode', async (_event, s2Id: string) => {
    try {
      const data = await fetchCitationDataByS2Id(s2Id);
      if (!data) {
        return { success: false, error: 'Paper not found on Semantic Scholar' };
      }

      db.saveCitationBatch(data.paper, data.references, data.citations);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to expand node' };
    }
  });
}
