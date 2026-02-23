import type { LibraryPaper } from '../../shared/types';
import { getCollectionsForPapers } from './collections';
import { getDb, type PaperRow, rowToLibraryPaper } from './connection';
import { getTagsForPapers } from './tags';
import { vectorSearch } from './vector-store';

export interface SemanticSearchResult {
  paper: LibraryPaper;
  score: number;
  matchType: 'hybrid' | 'keyword' | 'semantic';
}

const RRF_K = 60;

function hydratePaperRows(rows: PaperRow[]): LibraryPaper[] {
  if (rows.length === 0) return [];
  const paperIds = rows.map((r) => r.id);
  const collectionsMap = getCollectionsForPapers(paperIds);
  const tagsMap = getTagsForPapers(paperIds);
  return rows.map((r) => rowToLibraryPaper(r, collectionsMap.get(r.id) ?? [], tagsMap.get(r.id) ?? []));
}

export function hybridSearch(query: string, queryEmbedding: Float32Array, limit: number = 20): SemanticSearchResult[] {
  const db = getDb();
  const fetchLimit = limit * 2;

  // 1. FTS5 keyword search
  const ftsRows = db
    .prepare(`
      SELECT p.* FROM papers p
      JOIN papers_fts fts ON p.rowid = fts.rowid
      WHERE papers_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `)
    .all(query, fetchLimit) as PaperRow[];

  // 2. Vector search — deduplicate by paper_id (keep best chunk per paper)
  const vecResults = vectorSearch(db, queryEmbedding, fetchLimit);
  const bestVecByPaper = new Map<string, number>();
  for (const result of vecResults) {
    const existing = bestVecByPaper.get(result.paperId);
    if (existing === undefined || result.distance < existing) {
      bestVecByPaper.set(result.paperId, result.distance);
    }
  }

  // Sort vector results by distance (ascending = best first)
  const sortedVecPaperIds = [...bestVecByPaper.entries()].sort((a, b) => a[1] - b[1]).map(([paperId]) => paperId);

  // 3. Build RRF scores
  const rrfScores = new Map<string, number>();
  const matchTypes = new Map<string, Set<string>>();

  // FTS ranked list
  for (let rank = 0; rank < ftsRows.length; rank++) {
    const paperId = ftsRows[rank].id;
    const score = 1 / (RRF_K + rank + 1);
    rrfScores.set(paperId, (rrfScores.get(paperId) ?? 0) + score);
    if (!matchTypes.has(paperId)) matchTypes.set(paperId, new Set());
    matchTypes.get(paperId)!.add('keyword');
  }

  // Vector ranked list
  for (let rank = 0; rank < sortedVecPaperIds.length; rank++) {
    const paperId = sortedVecPaperIds[rank];
    const score = 1 / (RRF_K + rank + 1);
    rrfScores.set(paperId, (rrfScores.get(paperId) ?? 0) + score);
    if (!matchTypes.has(paperId)) matchTypes.set(paperId, new Set());
    matchTypes.get(paperId)!.add('semantic');
  }

  // 4. Sort by combined RRF score
  const sortedPaperIds = [...rrfScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([paperId, score]) => ({ paperId, score }));

  if (sortedPaperIds.length === 0) return [];

  // 5. Fetch full paper rows
  const placeholders = sortedPaperIds.map(() => '?').join(',');
  const paperRows = db
    .prepare(`SELECT * FROM papers WHERE id IN (${placeholders})`)
    .all(...sortedPaperIds.map((r) => r.paperId)) as PaperRow[];

  const papersById = new Map<string, PaperRow>();
  for (const row of paperRows) {
    papersById.set(row.id, row);
  }

  // Hydrate only the rows we need
  const rowsToHydrate = sortedPaperIds
    .map((r) => papersById.get(r.paperId))
    .filter((r): r is PaperRow => r !== undefined);

  const hydratedPapers = hydratePaperRows(rowsToHydrate);
  const hydratedById = new Map<string, LibraryPaper>();
  for (const paper of hydratedPapers) {
    hydratedById.set(paper.id, paper);
  }

  // 6. Build results in sorted order
  return sortedPaperIds
    .map(({ paperId, score }) => {
      const paper = hydratedById.get(paperId);
      if (!paper) return null;

      const types = matchTypes.get(paperId) ?? new Set();
      let matchType: 'hybrid' | 'keyword' | 'semantic';
      if (types.has('keyword') && types.has('semantic')) {
        matchType = 'hybrid';
      } else if (types.has('keyword')) {
        matchType = 'keyword';
      } else {
        matchType = 'semantic';
      }

      return { paper, score, matchType };
    })
    .filter((r): r is SemanticSearchResult => r !== null);
}
