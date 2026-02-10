import { ipcMain } from 'electron';
import type { ArxivPaper, PaperFilter, SavePaperResult } from '../shared/types';
import { searchArxiv } from './arxiv-client';
import * as db from './database';
import { getMcpHttpServerStatus, startMcpHttpServer, stopMcpHttpServer } from './mcp/http-server';
import { getDisabledTools, setDisabledTools } from './mcp/tool-config';
import { TOOL_METADATA } from './mcp/tools';
import { downloadAndExtractPdf } from './pdf-processor';
import { fetchCitationData, fetchCitationDataByS2Id } from './semantic-scholar/client';

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

  // --- MCP Server ---
  ipcMain.handle('mcp:getStatus', () => {
    return getMcpHttpServerStatus();
  });

  ipcMain.handle('mcp:start', async (_event, port: number) => {
    await startMcpHttpServer(port);
  });

  ipcMain.handle('mcp:stop', async () => {
    await stopMcpHttpServer();
  });

  ipcMain.handle('mcp:getTools', () => {
    const disabled = new Set(getDisabledTools());
    return TOOL_METADATA.map((tool) => ({
      name: tool.name,
      description: tool.description,
      enabled: !disabled.has(tool.name),
    }));
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

  // --- Citations ---

  const CACHE_TTL_DAYS = 30;

  ipcMain.handle('citations:fetch', async (_event, arxivId: string) => {
    try {
      const fetchedAt = db.getCitationFetchTime(arxivId);
      if (fetchedAt) {
        const age = Date.now() - new Date(fetchedAt + 'Z').getTime();
        if (age < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
          return { success: true };
        }
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
        const fetchedAt = db.getCitationFetchTime(arxivId);
        if (fetchedAt) {
          const age = Date.now() - new Date(fetchedAt + 'Z').getTime();
          if (age < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
            fetched++;
            continue;
          }
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

  ipcMain.handle('citations:expandNode', async (_event, s2Id: string) => {
    try {
      const data = await fetchCitationDataByS2Id(s2Id);
      if (!data) {
        return { success: false, error: 'Paper not found on Semantic Scholar' };
      }

      db.saveCitationBatchByS2Id(data.paper, data.references, data.citations);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to expand node' };
    }
  });
}
