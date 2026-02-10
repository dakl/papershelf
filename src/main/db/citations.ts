import type { CitationEdge, CitationGraphData, CitationNode } from '../../shared/types';
import { deserializeArray, getDb, serializeArray } from './connection';

interface S2PaperInput {
  s2Id: string;
  arxivId: string | null;
  title: string;
  authors: string[];
  year: number | null;
}

export type { S2PaperInput };

export function saveCitationBatch(
  paper: S2PaperInput,
  references: S2PaperInput[],
  citations: S2PaperInput[],
  arxivId?: string,
): void {
  const db = getDb();

  const upsertPaper = db.prepare(`
    INSERT INTO semantic_scholar_papers (s2_id, arxiv_id, title, authors, year)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(s2_id) DO UPDATE SET
      arxiv_id = COALESCE(excluded.arxiv_id, semantic_scholar_papers.arxiv_id),
      title = excluded.title,
      authors = excluded.authors,
      year = excluded.year,
      fetched_at = datetime('now')
  `);

  const insertEdge = db.prepare(`
    INSERT OR IGNORE INTO citation_edges (citing_s2_id, cited_s2_id) VALUES (?, ?)
  `);

  const markFetched = db.prepare(`
    INSERT INTO citation_fetch_log (arxiv_id) VALUES (?)
    ON CONFLICT(arxiv_id) DO UPDATE SET fetched_at = datetime('now')
  `);

  const transaction = db.transaction(() => {
    upsertPaper.run(paper.s2Id, paper.arxivId, paper.title, serializeArray(paper.authors), paper.year);

    for (const ref of references) {
      upsertPaper.run(ref.s2Id, ref.arxivId, ref.title, serializeArray(ref.authors), ref.year);
      insertEdge.run(paper.s2Id, ref.s2Id);
    }

    for (const cit of citations) {
      upsertPaper.run(cit.s2Id, cit.arxivId, cit.title, serializeArray(cit.authors), cit.year);
      insertEdge.run(cit.s2Id, paper.s2Id);
    }

    if (arxivId) {
      markFetched.run(arxivId);
    }
  });

  transaction();
}

export function getCitationGraph(): CitationGraphData {
  const db = getDb();

  const s2Rows = db.prepare('SELECT * FROM semantic_scholar_papers').all() as {
    s2_id: string;
    arxiv_id: string | null;
    title: string;
    authors: string;
    year: number | null;
  }[];

  const libraryArxivIds = new Set(
    (db.prepare('SELECT arxiv_id FROM papers').all() as { arxiv_id: string }[]).map((r) => r.arxiv_id),
  );

  const nodes: CitationNode[] = s2Rows.map((row) => ({
    semanticScholarId: row.s2_id,
    arxivId: row.arxiv_id,
    title: row.title,
    authors: deserializeArray(row.authors),
    year: row.year,
    inLibrary: row.arxiv_id !== null && libraryArxivIds.has(row.arxiv_id),
  }));

  const edgeRows = db.prepare('SELECT * FROM citation_edges').all() as {
    citing_s2_id: string;
    cited_s2_id: string;
  }[];

  const edges: CitationEdge[] = edgeRows.map((row) => ({
    source: row.citing_s2_id,
    target: row.cited_s2_id,
  }));

  return { nodes, edges };
}

export function getCitationFetchTime(arxivId: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT fetched_at FROM citation_fetch_log WHERE arxiv_id = ?').get(arxivId) as
    | { fetched_at: string }
    | undefined;
  return row?.fetched_at ?? null;
}

export function isCitationNodeExpanded(s2Id: string): boolean {
  const db = getDb();
  const edgeCount = db.prepare('SELECT COUNT(*) as cnt FROM citation_edges WHERE citing_s2_id = ?').get(s2Id) as {
    cnt: number;
  };
  return edgeCount.cnt > 0;
}

export function getS2IdsByArxivIds(arxivIds: string[]): string[] {
  if (arxivIds.length === 0) return [];
  const db = getDb();
  const placeholders = arxivIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT s2_id FROM semantic_scholar_papers WHERE arxiv_id IN (${placeholders})`)
    .all(...arxivIds) as { s2_id: string }[];
  return rows.map((r) => r.s2_id);
}

export function getCitationSubgraph(centerS2Ids: string[]): CitationGraphData {
  if (centerS2Ids.length === 0) return { nodes: [], edges: [] };

  const db = getDb();
  const placeholders = centerS2Ids.map(() => '?').join(',');

  const edgeRows = db
    .prepare(`
    SELECT citing_s2_id, cited_s2_id FROM citation_edges
    WHERE citing_s2_id IN (${placeholders}) OR cited_s2_id IN (${placeholders})
  `)
    .all(...centerS2Ids, ...centerS2Ids) as { citing_s2_id: string; cited_s2_id: string }[];

  const edges: CitationEdge[] = edgeRows.map((row) => ({
    source: row.citing_s2_id,
    target: row.cited_s2_id,
  }));

  const nodeIdSet = new Set<string>();
  for (const edge of edgeRows) {
    nodeIdSet.add(edge.citing_s2_id);
    nodeIdSet.add(edge.cited_s2_id);
  }
  for (const id of centerS2Ids) {
    nodeIdSet.add(id);
  }

  const allNodeIds = [...nodeIdSet];
  if (allNodeIds.length === 0) return { nodes: [], edges: [] };

  const nodePlaceholders = allNodeIds.map(() => '?').join(',');
  const s2Rows = db
    .prepare(`SELECT * FROM semantic_scholar_papers WHERE s2_id IN (${nodePlaceholders})`)
    .all(...allNodeIds) as {
    s2_id: string;
    arxiv_id: string | null;
    title: string;
    authors: string;
    year: number | null;
  }[];

  const libraryArxivIds = new Set(
    (db.prepare('SELECT arxiv_id FROM papers').all() as { arxiv_id: string }[]).map((r) => r.arxiv_id),
  );

  const nodes: CitationNode[] = s2Rows.map((row) => ({
    semanticScholarId: row.s2_id,
    arxivId: row.arxiv_id,
    title: row.title,
    authors: deserializeArray(row.authors),
    year: row.year,
    inLibrary: row.arxiv_id !== null && libraryArxivIds.has(row.arxiv_id),
  }));

  return { nodes, edges };
}
