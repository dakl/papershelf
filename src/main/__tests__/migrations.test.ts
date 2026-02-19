import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import { closeDatabase, initDatabase } from '../database';
import { runMigrations } from '../db/migrations';

let dbPath: string;

// SQL matching the old schema (before this PR)
const OLD_SCHEMA_SQL = `
  CREATE TABLE papers (
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

  CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#007AFF',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#007AFF',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE paper_collections (
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, collection_id)
  );

  CREATE TABLE paper_tags (
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, tag_id)
  );

  CREATE VIRTUAL TABLE papers_fts USING fts5(
    title, abstract, full_text, authors,
    content='papers',
    content_rowid='rowid'
  );

  CREATE TRIGGER papers_ai AFTER INSERT ON papers BEGIN
    INSERT INTO papers_fts(rowid, title, abstract, full_text, authors)
    VALUES (new.rowid, new.title, new.abstract, new.full_text, new.authors);
  END;

  CREATE TRIGGER papers_ad AFTER DELETE ON papers BEGIN
    INSERT INTO papers_fts(papers_fts, rowid, title, abstract, full_text, authors)
    VALUES ('delete', old.rowid, old.title, old.abstract, old.full_text, old.authors);
  END;

  CREATE TRIGGER papers_au AFTER UPDATE ON papers BEGIN
    INSERT INTO papers_fts(papers_fts, rowid, title, abstract, full_text, authors)
    VALUES ('delete', old.rowid, old.title, old.abstract, old.full_text, old.authors);
    INSERT INTO papers_fts(rowid, title, abstract, full_text, authors)
    VALUES (new.rowid, new.title, new.abstract, new.full_text, new.authors);
  END;

  CREATE TABLE paper_viewer_state (
    paper_id TEXT PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
    scale REAL NOT NULL DEFAULT 1.0,
    scroll_top REAL NOT NULL DEFAULT 0,
    scroll_left REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_papers_created_at ON papers(created_at DESC);
  CREATE INDEX idx_papers_published_date ON papers(published_date DESC);
  CREATE INDEX idx_papers_title ON papers(title COLLATE NOCASE);
  CREATE INDEX idx_papers_is_favorite ON papers(is_favorite);
  CREATE INDEX idx_paper_collections_collection_id ON paper_collections(collection_id);
  CREATE INDEX idx_paper_tags_tag_id ON paper_tags(tag_id);
`;

function cleanup() {
  try {
    fs.unlinkSync(dbPath);
    fs.unlinkSync(`${dbPath}-wal`);
    fs.unlinkSync(`${dbPath}-shm`);
  } catch {
    // cleanup best-effort
  }
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-migration-test-${Date.now()}.db`);
});

afterEach(() => {
  cleanup();
});

describe('migrations', () => {
  it('migrates old schema to new schema preserving data', () => {
    // Create a DB with the old schema and insert test data
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(OLD_SCHEMA_SQL);

    db.prepare(`
      INSERT INTO papers (id, arxiv_id, title, authors, abstract, published_date, updated_date, categories, arxiv_url, pdf_url, pdf_path, full_text, is_favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'test-id-1',
      '2401.00001',
      'Test Paper',
      '["Author One"]',
      'Abstract text',
      '2024-01-01',
      '2024-01-02',
      '["cs.AI"]',
      'https://arxiv.org/abs/2401.00001',
      'https://arxiv.org/pdf/2401.00001',
      '/path/to/paper.pdf',
      'Full text content',
      0,
    );

    // Add collection and tag relationships
    db.prepare('INSERT INTO collections (id, name, color) VALUES (?, ?, ?)').run('col-1', 'ML', '#FF0000');
    db.prepare('INSERT INTO paper_collections (paper_id, collection_id) VALUES (?, ?)').run('test-id-1', 'col-1');
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run('tag-1', 'important', '#00FF00');
    db.prepare('INSERT INTO paper_tags (paper_id, tag_id) VALUES (?, ?)').run('test-id-1', 'tag-1');

    // Run migration
    runMigrations(db);

    // Verify new columns exist
    const columns = db.pragma('table_info(papers)') as { name: string }[];
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('source');
    expect(columnNames).toContain('doi');

    // Verify data preserved
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get('test-id-1') as Record<string, unknown>;
    expect(paper.arxiv_id).toBe('2401.00001');
    expect(paper.title).toBe('Test Paper');
    expect(paper.source).toBe('arxiv');
    expect(paper.doi).toBeNull();
    expect(paper.pdf_path).toBe('/path/to/paper.pdf');
    expect(paper.full_text).toBe('Full text content');

    // Verify FK relationships preserved
    const paperCollections = db.prepare('SELECT * FROM paper_collections WHERE paper_id = ?').all('test-id-1');
    expect(paperCollections).toHaveLength(1);

    const paperTags = db.prepare('SELECT * FROM paper_tags WHERE paper_id = ?').all('test-id-1');
    expect(paperTags).toHaveLength(1);

    // Verify FTS works after migration
    const ftsResults = db
      .prepare(`
      SELECT p.* FROM papers p
      JOIN papers_fts fts ON p.rowid = fts.rowid
      WHERE papers_fts MATCH 'Test'
    `)
      .all();
    expect(ftsResults).toHaveLength(1);

    // Verify cascade delete still works
    db.prepare('DELETE FROM papers WHERE id = ?').run('test-id-1');
    const remainingCollections = db.prepare('SELECT * FROM paper_collections WHERE paper_id = ?').all('test-id-1');
    expect(remainingCollections).toHaveLength(0);

    db.close();
  });

  it('is idempotent (running twice is safe)', () => {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(OLD_SCHEMA_SQL);

    runMigrations(db);
    runMigrations(db); // should not throw

    const columns = db.pragma('table_info(papers)') as { name: string }[];
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('source');

    db.close();
  });

  it('does not run on fresh databases (already has source column)', () => {
    // Use initDatabase which creates the new schema directly
    initDatabase(dbPath);

    // Verify schema is correct
    const db = new Database(dbPath);
    const columns = db.pragma('table_info(papers)') as { name: string }[];
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('source');
    expect(columnNames).toContain('doi');

    db.close();
    closeDatabase();
  });
});
