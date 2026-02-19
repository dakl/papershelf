import type Database from 'better-sqlite3';
import { FTS_SQL, FTS_TRIGGERS_SQL, PAPER_INDEXES_SQL } from './connection';

export function runMigrations(db: Database.Database): void {
  const columns = db.pragma('table_info(papers)') as { name: string }[];
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has('source')) {
    migrateAddSourceAndNullableArxivId(db);
  }
}

function migrateAddSourceAndNullableArxivId(db: Database.Database): void {
  // Disable FK checks during migration — we're restructuring the papers table
  // and FK references from junction tables would block the DROP TABLE.
  db.pragma('foreign_keys = OFF');

  db.transaction(() => {
    db.exec(`
      CREATE TABLE papers_new (
        id TEXT PRIMARY KEY,
        arxiv_id TEXT UNIQUE,
        doi TEXT,
        source TEXT NOT NULL DEFAULT 'arxiv',
        title TEXT NOT NULL,
        authors TEXT NOT NULL,
        abstract TEXT NOT NULL DEFAULT '',
        published_date TEXT NOT NULL DEFAULT '',
        updated_date TEXT NOT NULL DEFAULT '',
        categories TEXT NOT NULL DEFAULT '[]',
        arxiv_url TEXT NOT NULL DEFAULT '',
        pdf_url TEXT NOT NULL DEFAULT '',
        pdf_path TEXT,
        full_text TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      INSERT INTO papers_new
        (id, arxiv_id, doi, source, title, authors, abstract, published_date,
         updated_date, categories, arxiv_url, pdf_url, pdf_path, full_text,
         is_favorite, created_at)
      SELECT
        id, arxiv_id, NULL, 'arxiv', title, authors, abstract, published_date,
        updated_date, categories, arxiv_url, pdf_url, pdf_path, full_text,
        is_favorite, created_at
      FROM papers;
    `);

    db.exec(`DROP TRIGGER IF EXISTS papers_ai`);
    db.exec(`DROP TRIGGER IF EXISTS papers_ad`);
    db.exec(`DROP TRIGGER IF EXISTS papers_au`);
    db.exec(`DROP TABLE IF EXISTS papers_fts`);
    db.exec(`DROP TABLE papers`);
    db.exec(`ALTER TABLE papers_new RENAME TO papers`);

    db.exec(FTS_SQL);

    // Rebuild FTS index from existing data
    db.exec(`
      INSERT INTO papers_fts(rowid, title, abstract, full_text, authors)
      SELECT rowid, title, abstract, full_text, authors FROM papers;
    `);

    db.exec(FTS_TRIGGERS_SQL);
    db.exec(PAPER_INDEXES_SQL);
  })();

  db.pragma('foreign_keys = ON');
}
