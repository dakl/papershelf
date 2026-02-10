import { ipcMain } from 'electron';
import type { ArxivPaper, PaperFilter, SavePaperResult } from '../shared/types';
import { searchArxiv } from './arxiv-client';
import { CITATION_CACHE_TTL_DAYS } from './constants';
import * as db from './database';
import { getMcpHttpServerStatus, startMcpHttpServer, stopMcpHttpServer } from './mcp/http-server';
import { getDisabledTools, setDisabledTools } from './mcp/tool-config';
import { TOOL_METADATA } from './mcp/tools';
import { fetchCitationData, fetchCitationDataByS2Id } from './semantic-scholar/client';
import { isCitationCacheFresh } from './services/citation-cache';
import { savePaperFromArxivPaper } from './services/save-paper';

export function registerIpcHandlers(): void {
  // --- ArXiv ---
  ipcMain.handle('arxiv:search', async (_event, query: string) => {
    return searchArxiv(query);
  });

  // --- Papers ---
  ipcMain.handle('papers:save', async (_event, paper: ArxivPaper): Promise<SavePaperResult> => {
    try {
      const result = await savePaperFromArxivPaper(paper);
      return { success: true, paper: result.paper };
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
