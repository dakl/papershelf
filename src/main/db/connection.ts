import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import type { Collection, LibraryPaper, Tag } from '../../shared/types';
import { getDataDir } from '../paths';

let db: Database.Database;

export function getDb(): Database.Database {
  return db;
}

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

    CREATE TABLE IF NOT EXISTS tool_call_log (
      id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      input_args TEXT NOT NULL DEFAULT '{}',
      duration_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      called_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// --- Shared helpers ---

export function generateId(): string {
  return crypto.randomUUID();
}

export function serializeArray(arr: string[]): string {
  return JSON.stringify(arr);
}

export function deserializeArray(json: string): string[] {
  return JSON.parse(json) as string[];
}

export interface PaperRow {
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

export function rowToLibraryPaper(row: PaperRow, collections: Collection[] = [], tags: Tag[] = []): LibraryPaper {
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

export interface CollectionRow {
  id: string;
  name: string;
  color: string;
  paper_count: number;
  created_at: string;
}

export function rowToCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    paperCount: row.paper_count,
    createdAt: row.created_at,
  };
}

export interface TagRow {
  id: string;
  name: string;
  color: string;
  paper_count: number;
  created_at: string;
}

export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    paperCount: row.paper_count,
    createdAt: row.created_at,
  };
}
