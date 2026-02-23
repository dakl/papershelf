import type Database from 'better-sqlite3';
import { generateId, getDb } from './connection';

const EMBEDDING_DIMS = 256;

export function createVectorSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_chunks (
      id TEXT PRIMARY KEY,
      paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      chunk_type TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      token_count INTEGER,
      embedding BLOB,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper_id ON paper_chunks(paper_id);

    CREATE TABLE IF NOT EXISTS embedding_status (
      paper_id TEXT PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      chunk_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export interface ChunkInsertData {
  paperId: string;
  chunkType: string;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
}

export function insertChunkWithEmbedding(
  db: Database.Database,
  chunk: ChunkInsertData,
  embedding: Float32Array,
): string {
  const chunkId = generateId();
  const embeddingBlob = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

  db.prepare(`
    INSERT INTO paper_chunks (id, paper_id, chunk_type, chunk_index, chunk_text, token_count, embedding)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chunkId, chunk.paperId, chunk.chunkType, chunk.chunkIndex, chunk.chunkText, chunk.tokenCount, embeddingBlob);

  return chunkId;
}

export function deleteChunksForPaper(db: Database.Database, paperId: string): void {
  db.prepare('DELETE FROM paper_chunks WHERE paper_id = ?').run(paperId);
}

export type EmbeddingStatusValue = 'pending' | 'indexing' | 'complete' | 'failed';

export function setEmbeddingStatus(
  db: Database.Database,
  paperId: string,
  status: EmbeddingStatusValue,
  errorMessage?: string,
  chunkCount?: number,
): void {
  db.prepare(`
    INSERT INTO embedding_status (paper_id, status, error_message, chunk_count, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(paper_id) DO UPDATE SET
      status = excluded.status,
      error_message = excluded.error_message,
      chunk_count = COALESCE(excluded.chunk_count, chunk_count),
      updated_at = datetime('now')
  `).run(paperId, status, errorMessage ?? null, chunkCount ?? 0);
}

export interface VectorSearchResult {
  chunkId: string;
  paperId: string;
  distance: number;
  chunkText: string;
  chunkType: string;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  // Vectors are already L2-normalized, so dot product = cosine similarity
  return dot;
}

export function vectorSearch(db: Database.Database, queryEmbedding: Float32Array, limit: number): VectorSearchResult[] {
  const rows = db
    .prepare('SELECT id, paper_id, chunk_text, chunk_type, embedding FROM paper_chunks WHERE embedding IS NOT NULL')
    .all() as {
    id: string;
    paper_id: string;
    chunk_text: string;
    chunk_type: string;
    embedding: Buffer;
  }[];

  const scored = rows.map((row) => {
    const embeddingArray = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, EMBEDDING_DIMS);
    const similarity = cosineSimilarity(queryEmbedding, embeddingArray);
    // Convert similarity to distance (lower = more similar) for compatibility
    const distance = 1 - similarity;
    return {
      chunkId: row.id,
      paperId: row.paper_id,
      distance,
      chunkText: row.chunk_text,
      chunkType: row.chunk_type,
    };
  });

  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, limit);
}

export function getEmbeddingStatusForPapers(
  db: Database.Database,
  paperIds: string[],
): Map<string, EmbeddingStatusValue> {
  if (paperIds.length === 0) return new Map();

  const placeholders = paperIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT paper_id, status FROM embedding_status WHERE paper_id IN (${placeholders})`)
    .all(...paperIds) as { paper_id: string; status: string }[];

  const map = new Map<string, EmbeddingStatusValue>();
  for (const row of rows) {
    map.set(row.paper_id, row.status as EmbeddingStatusValue);
  }
  return map;
}

export function getPapersNeedingEmbedding(db: Database.Database): { id: string; title: string }[] {
  return db
    .prepare(`
      SELECT p.id, p.title FROM papers p
      LEFT JOIN embedding_status es ON p.id = es.paper_id
      WHERE es.paper_id IS NULL
        OR es.status IN ('pending', 'failed')
    `)
    .all() as { id: string; title: string }[];
}

export interface IndexingStats {
  totalPapers: number;
  indexed: number;
  pending: number;
  failed: number;
}

export function getIndexingStats(db: Database.Database): IndexingStats {
  const totalPapers = (db.prepare('SELECT COUNT(*) as count FROM papers').get() as { count: number }).count;

  const indexed = (
    db.prepare("SELECT COUNT(*) as count FROM embedding_status WHERE status = 'complete'").get() as { count: number }
  ).count;

  const failed = (
    db.prepare("SELECT COUNT(*) as count FROM embedding_status WHERE status = 'failed'").get() as { count: number }
  ).count;

  const pending = totalPapers - indexed - failed;

  return { totalPapers, indexed, pending, failed };
}

// Convenience wrappers that use the default db connection
export function getIndexingStatsFromDb(): IndexingStats {
  return getIndexingStats(getDb());
}
