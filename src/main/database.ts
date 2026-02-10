import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import type {
  CitationEdge,
  CitationGraphData,
  CitationNode,
  Collection,
  LibraryPaper,
  PaperFilter,
  Tag,
} from '../shared/types';
import { getDataDir } from './paths';

let db: Database.Database;

export function initDatabase(customPath?: string): void {
  const dbPath = customPath ?? path.join(getDataDir(), 'papershelf.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema();
}

export function closeDatabase(): void {
  if (db) db.close();
}

function createSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      arxiv_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      abstract TEXT NOT NULL,
      published_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      categories TEXT NOT NULL,
      arxiv_url TEXT NOT NULL,
      pdf_url TEXT NOT NULL,
      pdf_path TEXT,
      full_text TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#007AFF',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#007AFF',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS paper_collections (
      paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      PRIMARY KEY (paper_id, collection_id)
    );

    CREATE TABLE IF NOT EXISTS paper_tags (
      paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (paper_id, tag_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
      title, abstract, full_text, authors,
      content='papers',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS papers_ai AFTER INSERT ON papers BEGIN
      INSERT INTO papers_fts(rowid, title, abstract, full_text, authors)
      VALUES (new.rowid, new.title, new.abstract, new.full_text, new.authors);
    END;

    CREATE TRIGGER IF NOT EXISTS papers_ad AFTER DELETE ON papers BEGIN
      INSERT INTO papers_fts(papers_fts, rowid, title, abstract, full_text, authors)
      VALUES ('delete', old.rowid, old.title, old.abstract, old.full_text, old.authors);
    END;

    CREATE TRIGGER IF NOT EXISTS papers_au AFTER UPDATE ON papers BEGIN
      INSERT INTO papers_fts(papers_fts, rowid, title, abstract, full_text, authors)
      VALUES ('delete', old.rowid, old.title, old.abstract, old.full_text, old.authors);
      INSERT INTO papers_fts(rowid, title, abstract, full_text, authors)
      VALUES (new.rowid, new.title, new.abstract, new.full_text, new.authors);
    END;

    CREATE TABLE IF NOT EXISTS semantic_scholar_papers (
      s2_id TEXT PRIMARY KEY,
      arxiv_id TEXT,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      year INTEGER,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS citation_edges (
      citing_s2_id TEXT NOT NULL,
      cited_s2_id TEXT NOT NULL,
      PRIMARY KEY (citing_s2_id, cited_s2_id)
    );

    CREATE TABLE IF NOT EXISTS citation_fetch_log (
      arxiv_id TEXT PRIMARY KEY,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// --- Helpers ---

function generateId(): string {
  return crypto.randomUUID();
}

function serializeArray(arr: string[]): string {
  return JSON.stringify(arr);
}

function deserializeArray(json: string): string[] {
  return JSON.parse(json) as string[];
}

interface PaperRow {
  id: string;
  arxiv_id: string;
  title: string;
  authors: string;
  abstract: string;
  published_date: string;
  updated_date: string;
  categories: string;
  arxiv_url: string;
  pdf_url: string;
  pdf_path: string | null;
  full_text: string | null;
  is_favorite: number;
  created_at: string;
}

function rowToLibraryPaper(row: PaperRow, collections: Collection[] = [], tags: Tag[] = []): LibraryPaper {
  return {
    id: row.id,
    arxivId: row.arxiv_id,
    title: row.title,
    authors: deserializeArray(row.authors),
    abstract: row.abstract,
    publishedDate: row.published_date,
    updatedDate: row.updated_date,
    categories: deserializeArray(row.categories),
    arxivUrl: row.arxiv_url,
    pdfUrl: row.pdf_url,
    pdfPath: row.pdf_path,
    fullText: row.full_text,
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
    collections,
    tags,
  };
}

interface CollectionRow {
  id: string;
  name: string;
  color: string;
  paper_count: number;
  created_at: string;
}

function rowToCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    paperCount: row.paper_count,
    createdAt: row.created_at,
  };
}

interface TagRow {
  id: string;
  name: string;
  color: string;
  paper_count: number;
  created_at: string;
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    paperCount: row.paper_count,
    createdAt: row.created_at,
  };
}

// --- Papers ---

export function insertPaper(paper: {
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  publishedDate: string;
  updatedDate: string;
  categories: string[];
  arxivUrl: string;
  pdfUrl: string;
  pdfPath: string | null;
  fullText: string | null;
}): LibraryPaper {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO papers (id, arxiv_id, title, authors, abstract, published_date, updated_date, categories, arxiv_url, pdf_url, pdf_path, full_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    paper.arxivId,
    paper.title,
    serializeArray(paper.authors),
    paper.abstract,
    paper.publishedDate,
    paper.updatedDate,
    serializeArray(paper.categories),
    paper.arxivUrl,
    paper.pdfUrl,
    paper.pdfPath,
    paper.fullText,
  );
  return getPaperById(id)!;
}

export function getPaperById(id: string): LibraryPaper | null {
  const row = db.prepare('SELECT * FROM papers WHERE id = ?').get(id) as PaperRow | undefined;
  if (!row) return null;
  const collections = getCollectionsForPaper(row.id);
  const tags = getTagsForPaper(row.id);
  return rowToLibraryPaper(row, collections, tags);
}

export function getPaperByArxivId(arxivId: string): LibraryPaper | null {
  const row = db.prepare('SELECT * FROM papers WHERE arxiv_id = ?').get(arxivId) as PaperRow | undefined;
  if (!row) return null;
  const collections = getCollectionsForPaper(row.id);
  const tags = getTagsForPaper(row.id);
  return rowToLibraryPaper(row, collections, tags);
}

export function getPapers(filter: PaperFilter): LibraryPaper[] {
  let rows: PaperRow[];

  switch (filter.view) {
    case 'all-papers':
      rows = db.prepare('SELECT * FROM papers ORDER BY created_at DESC').all() as PaperRow[];
      break;
    case 'favorites':
      rows = db.prepare('SELECT * FROM papers WHERE is_favorite = 1 ORDER BY created_at DESC').all() as PaperRow[];
      break;
    case 'recent':
      rows = db.prepare('SELECT * FROM papers ORDER BY created_at DESC LIMIT 50').all() as PaperRow[];
      break;
    case 'collection':
      rows = db
        .prepare(`
        SELECT p.* FROM papers p
        JOIN paper_collections pc ON p.id = pc.paper_id
        WHERE pc.collection_id = ?
        ORDER BY p.created_at DESC
      `)
        .all(filter.collectionId) as PaperRow[];
      break;
    case 'tag':
      rows = db
        .prepare(`
        SELECT p.* FROM papers p
        JOIN paper_tags pt ON p.id = pt.paper_id
        WHERE pt.tag_id = ?
        ORDER BY p.created_at DESC
      `)
        .all(filter.tagId) as PaperRow[];
      break;
    default:
      rows = [];
  }

  return rows.map((row) => {
    const collections = getCollectionsForPaper(row.id);
    const tags = getTagsForPaper(row.id);
    return rowToLibraryPaper(row, collections, tags);
  });
}

export function deletePaper(id: string): void {
  db.prepare('DELETE FROM papers WHERE id = ?').run(id);
}

export function toggleFavorite(id: string): boolean {
  const row = db.prepare('SELECT is_favorite FROM papers WHERE id = ?').get(id) as { is_favorite: number } | undefined;
  if (!row) throw new Error(`Paper not found: ${id}`);
  const newValue = row.is_favorite === 1 ? 0 : 1;
  db.prepare('UPDATE papers SET is_favorite = ? WHERE id = ?').run(newValue, id);
  return newValue === 1;
}

export function checkPapersInLibrary(arxivIds: string[]): string[] {
  if (arxivIds.length === 0) return [];
  const placeholders = arxivIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT arxiv_id FROM papers WHERE arxiv_id IN (${placeholders})`).all(...arxivIds) as {
    arxiv_id: string;
  }[];
  return rows.map((r) => r.arxiv_id);
}

export function updatePaperPdf(id: string, pdfPath: string, fullText: string | null): void {
  db.prepare('UPDATE papers SET pdf_path = ?, full_text = ? WHERE id = ?').run(pdfPath, fullText, id);
}

// --- FTS5 Search ---

export function searchLibrary(query: string): LibraryPaper[] {
  const rows = db
    .prepare(`
    SELECT p.* FROM papers p
    JOIN papers_fts fts ON p.rowid = fts.rowid
    WHERE papers_fts MATCH ?
    ORDER BY rank
  `)
    .all(query) as PaperRow[];

  return rows.map((row) => {
    const collections = getCollectionsForPaper(row.id);
    const tags = getTagsForPaper(row.id);
    return rowToLibraryPaper(row, collections, tags);
  });
}

// --- Collections ---

export function getCollectionByName(name: string): Collection | null {
  const row = db
    .prepare(`
    SELECT c.*, COUNT(pc.paper_id) as paper_count
    FROM collections c
    LEFT JOIN paper_collections pc ON c.id = pc.collection_id
    WHERE c.name = ?
    GROUP BY c.id
  `)
    .get(name) as CollectionRow | undefined;
  return row ? rowToCollection(row) : null;
}

export function getCollections(): Collection[] {
  const rows = db
    .prepare(`
    SELECT c.*, COUNT(pc.paper_id) as paper_count
    FROM collections c
    LEFT JOIN paper_collections pc ON c.id = pc.collection_id
    GROUP BY c.id
    ORDER BY c.name
  `)
    .all() as CollectionRow[];
  return rows.map(rowToCollection);
}

export function createCollection(name: string, color: string): Collection {
  const id = generateId();
  db.prepare('INSERT INTO collections (id, name, color) VALUES (?, ?, ?)').run(id, name, color);
  return { id, name, color, paperCount: 0, createdAt: new Date().toISOString() };
}

export function updateCollection(id: string, name: string, color: string): Collection {
  db.prepare('UPDATE collections SET name = ?, color = ? WHERE id = ?').run(name, color, id);
  const row = db
    .prepare(`
    SELECT c.*, COUNT(pc.paper_id) as paper_count
    FROM collections c
    LEFT JOIN paper_collections pc ON c.id = pc.collection_id
    WHERE c.id = ?
    GROUP BY c.id
  `)
    .get(id) as CollectionRow;
  return rowToCollection(row);
}

export function deleteCollection(id: string): void {
  db.prepare('DELETE FROM collections WHERE id = ?').run(id);
}

export function addPaperToCollection(paperId: string, collectionId: string): void {
  db.prepare('INSERT OR IGNORE INTO paper_collections (paper_id, collection_id) VALUES (?, ?)').run(
    paperId,
    collectionId,
  );
}

export function removePaperFromCollection(paperId: string, collectionId: string): void {
  db.prepare('DELETE FROM paper_collections WHERE paper_id = ? AND collection_id = ?').run(paperId, collectionId);
}

export function getCollectionsForPaper(paperId: string): Collection[] {
  const rows = db
    .prepare(`
    SELECT c.*, COUNT(pc2.paper_id) as paper_count
    FROM collections c
    JOIN paper_collections pc ON c.id = pc.collection_id
    LEFT JOIN paper_collections pc2 ON c.id = pc2.collection_id
    WHERE pc.paper_id = ?
    GROUP BY c.id
  `)
    .all(paperId) as CollectionRow[];
  return rows.map(rowToCollection);
}

// --- Tags ---

export function getTagByName(name: string): Tag | null {
  const row = db
    .prepare(`
    SELECT t.*, COUNT(pt.paper_id) as paper_count
    FROM tags t
    LEFT JOIN paper_tags pt ON t.id = pt.tag_id
    WHERE t.name = ?
    GROUP BY t.id
  `)
    .get(name) as TagRow | undefined;
  return row ? rowToTag(row) : null;
}

export function getTags(): Tag[] {
  const rows = db
    .prepare(`
    SELECT t.*, COUNT(pt.paper_id) as paper_count
    FROM tags t
    LEFT JOIN paper_tags pt ON t.id = pt.tag_id
    GROUP BY t.id
    ORDER BY t.name
  `)
    .all() as TagRow[];
  return rows.map(rowToTag);
}

export function createTag(name: string, color: string): Tag {
  const id = generateId();
  db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name, color);
  return { id, name, color, paperCount: 0, createdAt: new Date().toISOString() };
}

export function updateTag(id: string, name: string, color: string): Tag {
  db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, id);
  const row = db
    .prepare(`
    SELECT t.*, COUNT(pt.paper_id) as paper_count
    FROM tags t
    LEFT JOIN paper_tags pt ON t.id = pt.tag_id
    WHERE t.id = ?
    GROUP BY t.id
  `)
    .get(id) as TagRow;
  return rowToTag(row);
}

export function deleteTag(id: string): void {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
}

export function addTagToPaper(paperId: string, tagId: string): void {
  db.prepare('INSERT OR IGNORE INTO paper_tags (paper_id, tag_id) VALUES (?, ?)').run(paperId, tagId);
}

export function removeTagFromPaper(paperId: string, tagId: string): void {
  db.prepare('DELETE FROM paper_tags WHERE paper_id = ? AND tag_id = ?').run(paperId, tagId);
}

export function getTagsForPaper(paperId: string): Tag[] {
  const rows = db
    .prepare(`
    SELECT t.*, COUNT(pt2.paper_id) as paper_count
    FROM tags t
    JOIN paper_tags pt ON t.id = pt.tag_id
    LEFT JOIN paper_tags pt2 ON t.id = pt2.tag_id
    WHERE pt.paper_id = ?
    GROUP BY t.id
  `)
    .all(paperId) as TagRow[];
  return rows.map(rowToTag);
}

// --- Citations ---

interface S2PaperInput {
  s2Id: string;
  arxivId: string | null;
  title: string;
  authors: string[];
  year: number | null;
}

export function saveCitationBatch(
  paper: S2PaperInput,
  references: S2PaperInput[],
  citations: S2PaperInput[],
  arxivId: string,
): void {
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
    // Upsert the center paper
    upsertPaper.run(paper.s2Id, paper.arxivId, paper.title, serializeArray(paper.authors), paper.year);

    // Upsert references and create edges (this paper cites them)
    for (const ref of references) {
      upsertPaper.run(ref.s2Id, ref.arxivId, ref.title, serializeArray(ref.authors), ref.year);
      insertEdge.run(paper.s2Id, ref.s2Id);
    }

    // Upsert citations and create edges (they cite this paper)
    for (const cit of citations) {
      upsertPaper.run(cit.s2Id, cit.arxivId, cit.title, serializeArray(cit.authors), cit.year);
      insertEdge.run(cit.s2Id, paper.s2Id);
    }

    markFetched.run(arxivId);
  });

  transaction();
}

export function saveCitationBatchByS2Id(
  paper: S2PaperInput,
  references: S2PaperInput[],
  citations: S2PaperInput[],
): void {
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
  });

  transaction();
}

export function getCitationGraph(): CitationGraphData {
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
  const row = db.prepare('SELECT fetched_at FROM citation_fetch_log WHERE arxiv_id = ?').get(arxivId) as
    | { fetched_at: string }
    | undefined;
  return row?.fetched_at ?? null;
}

export function isCitationNodeExpanded(s2Id: string): boolean {
  const edgeCount = db.prepare('SELECT COUNT(*) as cnt FROM citation_edges WHERE citing_s2_id = ?').get(s2Id) as {
    cnt: number;
  };
  return edgeCount.cnt > 0;
}

export function getS2IdsByArxivIds(arxivIds: string[]): string[] {
  if (arxivIds.length === 0) return [];
  const placeholders = arxivIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT s2_id FROM semantic_scholar_papers WHERE arxiv_id IN (${placeholders})`)
    .all(...arxivIds) as { s2_id: string }[];
  return rows.map((r) => r.s2_id);
}

export function getCitationSubgraph(centerS2Ids: string[]): CitationGraphData {
  if (centerS2Ids.length === 0) return { nodes: [], edges: [] };

  const placeholders = centerS2Ids.map(() => '?').join(',');

  // 1-hop edges: at least one end is in centerS2Ids
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

  // Collect all node IDs referenced by edges
  const nodeIdSet = new Set<string>();
  for (const edge of edgeRows) {
    nodeIdSet.add(edge.citing_s2_id);
    nodeIdSet.add(edge.cited_s2_id);
  }
  // Also include center IDs even if they have no edges yet
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
