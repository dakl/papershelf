import type { LibraryPaper, PaperFilter } from '../../shared/types';
import { getCollectionsForPaper } from './collections';
import { generateId, getDb, type PaperRow, rowToLibraryPaper, serializeArray } from './connection';
import { getTagsForPaper } from './tags';

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
  const db = getDb();
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

export function getPapers(filter: PaperFilter): LibraryPaper[] {
  const db = getDb();
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
  getDb().prepare('DELETE FROM papers WHERE id = ?').run(id);
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

  return rows.map((row) => {
    const collections = getCollectionsForPaper(row.id);
    const tags = getTagsForPaper(row.id);
    return rowToLibraryPaper(row, collections, tags);
  });
}
