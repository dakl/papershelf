import type { LibraryPaper, PaperFilter, PaperMetadataUpdate, PaperSource } from '../../shared/types';
import { DataChangeEvent, eventEmitter } from '../event-emitter';
import { getCollectionsForPaper, getCollectionsForPapers } from './collections';
import { generateId, getDb, type PaperRow, rowToLibraryPaper, serializeArray } from './connection';
import { getTagsForPaper, getTagsForPapers } from './tags';

function hydratePaperRows(rows: PaperRow[]): LibraryPaper[] {
  if (rows.length === 0) return [];

  const paperIds = rows.map((row) => row.id);
  const collectionsMap = getCollectionsForPapers(paperIds);
  const tagsMap = getTagsForPapers(paperIds);

  return rows.map((row) => rowToLibraryPaper(row, collectionsMap.get(row.id) ?? [], tagsMap.get(row.id) ?? []));
}

export function insertPaper(paper: {
  arxivId: string | null;
  doi?: string | null;
  source?: PaperSource;
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
  const db = getDb();
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO papers (id, arxiv_id, doi, source, title, authors, abstract, published_date, updated_date, categories, arxiv_url, pdf_url, pdf_path, full_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    paper.arxivId,
    paper.doi ?? null,
    paper.source ?? 'arxiv',
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
  const result = getPaperById(id)!;
  eventEmitter.emit(DataChangeEvent.PAPERS_CHANGED);
  return result;
}

export function getPaperById(id: string): LibraryPaper | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM papers WHERE id = ?').get(id) as PaperRow | undefined;
  if (!row) return null;
  const collections = getCollectionsForPaper(row.id);
  const tags = getTagsForPaper(row.id);
  return rowToLibraryPaper(row, collections, tags);
}

export function getPaperByArxivId(arxivId: string): LibraryPaper | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM papers WHERE arxiv_id = ?').get(arxivId) as PaperRow | undefined;
  if (!row) return null;
  const collections = getCollectionsForPaper(row.id);
  const tags = getTagsForPaper(row.id);
  return rowToLibraryPaper(row, collections, tags);
}

function buildOrderClause(filter: PaperFilter, tableAlias?: string): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';

  if (filter.view === 'recent') {
    return `ORDER BY ${prefix}created_at DESC`;
  }

  const sortBy = filter.sortBy ?? 'created_at';
  const direction = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';

  if (sortBy === 'first_author') {
    return `ORDER BY json_extract(${prefix}authors, '$[0]') COLLATE NOCASE ${direction}`;
  }

  if (sortBy === 'title') {
    return `ORDER BY ${prefix}title COLLATE NOCASE ${direction}`;
  }

  return `ORDER BY ${prefix}${sortBy} ${direction}`;
}

export function getPapers(filter: PaperFilter): LibraryPaper[] {
  const db = getDb();
  let rows: PaperRow[];

  switch (filter.view) {
    case 'all-papers':
      rows = db.prepare(`SELECT * FROM papers ${buildOrderClause(filter)}`).all() as PaperRow[];
      break;
    case 'favorites':
      rows = db.prepare(`SELECT * FROM papers WHERE is_favorite = 1 ${buildOrderClause(filter)}`).all() as PaperRow[];
      break;
    case 'recent':
      rows = db.prepare(`SELECT * FROM papers ${buildOrderClause(filter)} LIMIT 50`).all() as PaperRow[];
      break;
    case 'collection':
      rows = db
        .prepare(`
        SELECT p.* FROM papers p
        JOIN paper_collections pc ON p.id = pc.paper_id
        WHERE pc.collection_id = ?
        ${buildOrderClause(filter, 'p')}
      `)
        .all(filter.collectionId) as PaperRow[];
      break;
    case 'tag':
      rows = db
        .prepare(`
        SELECT p.* FROM papers p
        JOIN paper_tags pt ON p.id = pt.paper_id
        WHERE pt.tag_id = ?
        ${buildOrderClause(filter, 'p')}
      `)
        .all(filter.tagId) as PaperRow[];
      break;
    default:
      rows = [];
  }

  return hydratePaperRows(rows);
}

export function deletePaper(id: string): void {
  getDb().prepare('DELETE FROM papers WHERE id = ?').run(id);
  eventEmitter.emit(DataChangeEvent.PAPERS_CHANGED);
}

export function toggleFavorite(id: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT is_favorite FROM papers WHERE id = ?').get(id) as { is_favorite: number } | undefined;
  if (!row) throw new Error(`Paper not found: ${id}`);
  const newValue = row.is_favorite === 1 ? 0 : 1;
  db.prepare('UPDATE papers SET is_favorite = ? WHERE id = ?').run(newValue, id);
  return newValue === 1;
}

export function checkPapersInLibrary(arxivIds: string[]): string[] {
  if (arxivIds.length === 0) return [];
  const db = getDb();
  const placeholders = arxivIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT arxiv_id FROM papers WHERE arxiv_id IN (${placeholders})`).all(...arxivIds) as {
    arxiv_id: string;
  }[];
  return rows.map((r) => r.arxiv_id);
}

export function updatePaperPdf(id: string, pdfPath: string, fullText: string | null): void {
  getDb().prepare('UPDATE papers SET pdf_path = ?, full_text = ? WHERE id = ?').run(pdfPath, fullText, id);
}

export function updatePaperPdfPath(id: string, pdfPath: string): void {
  getDb().prepare('UPDATE papers SET pdf_path = ? WHERE id = ?').run(pdfPath, id);
}

export function getAllPaperPdfPaths(): { id: string; pdfPath: string }[] {
  const rows = getDb().prepare('SELECT id, pdf_path FROM papers WHERE pdf_path IS NOT NULL').all() as {
    id: string;
    pdf_path: string;
  }[];
  return rows.map((r) => ({ id: r.id, pdfPath: r.pdf_path }));
}

export interface LibraryStats {
  paperCount: number;
  favoriteCount: number;
  collectionCount: number;
  tagCount: number;
}

export function getLibraryStats(): LibraryStats {
  const db = getDb();
  const paperCount = (db.prepare('SELECT COUNT(*) as count FROM papers').get() as { count: number }).count;
  const favoriteCount = (
    db.prepare('SELECT COUNT(*) as count FROM papers WHERE is_favorite = 1').get() as { count: number }
  ).count;
  const collectionCount = (db.prepare('SELECT COUNT(*) as count FROM collections').get() as { count: number }).count;
  const tagCount = (db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number }).count;
  return { paperCount, favoriteCount, collectionCount, tagCount };
}

export function updatePaperMetadata(id: string, updates: PaperMetadataUpdate): LibraryPaper {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM papers WHERE id = ?').get(id);
  if (!existing) throw new Error(`Paper not found: ${id}`);

  const fieldMap: Record<string, unknown> = {};
  if (updates.title !== undefined) fieldMap.title = updates.title;
  if (updates.authors !== undefined) fieldMap.authors = serializeArray(updates.authors);
  if (updates.abstract !== undefined) fieldMap.abstract = updates.abstract;
  if (updates.publishedDate !== undefined) fieldMap.published_date = updates.publishedDate;
  if (updates.doi !== undefined) fieldMap.doi = updates.doi;
  if (updates.categories !== undefined) fieldMap.categories = serializeArray(updates.categories);

  if (Object.keys(fieldMap).length > 0) {
    const setClauses = Object.keys(fieldMap)
      .map((col) => `${col} = ?`)
      .join(', ');
    const values = Object.values(fieldMap);
    db.prepare(`UPDATE papers SET ${setClauses} WHERE id = ?`).run(...values, id);
  }

  const result = getPaperById(id)!;
  eventEmitter.emit(DataChangeEvent.PAPERS_CHANGED);
  return result;
}

export function searchLibrary(query: string): LibraryPaper[] {
  const db = getDb();
  const rows = db
    .prepare(`
    SELECT p.* FROM papers p
    JOIN papers_fts fts ON p.rowid = fts.rowid
    WHERE papers_fts MATCH ?
    ORDER BY rank
  `)
    .all(query) as PaperRow[];

  return hydratePaperRows(rows);
}
