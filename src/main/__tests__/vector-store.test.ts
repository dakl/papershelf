import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import { closeDatabase, initDatabase } from '../database';
import { getDb } from '../db/connection';
import { insertPaper } from '../db/papers';
import {
  deleteChunksForPaper,
  getEmbeddingStatusForPapers,
  getIndexingStats,
  getPapersNeedingEmbedding,
  insertChunkWithEmbedding,
  setEmbeddingStatus,
  vectorSearch,
} from '../db/vector-store';

let dbPath: string;

function makePaper(overrides: Partial<Parameters<typeof insertPaper>[0]> = {}) {
  return {
    arxivId: '2401.00001' as string | null,
    title: 'Test Paper',
    authors: ['Author One'],
    abstract: 'Test abstract',
    publishedDate: '2024-01-01T00:00:00Z',
    updatedDate: '2024-01-01T00:00:00Z',
    categories: ['cs.AI'],
    arxivUrl: 'https://arxiv.org/abs/2401.00001',
    pdfUrl: 'https://arxiv.org/pdf/2401.00001',
    pdfPath: null,
    fullText: null,
    ...overrides,
  };
}

function makeMockEmbedding(seed: number = 1): Float32Array {
  const embedding = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    embedding[i] = Math.sin(seed * (i + 1));
  }
  // L2 normalize
  let norm = 0;
  for (const v of embedding) norm += v * v;
  norm = Math.sqrt(norm);
  for (let i = 0; i < 256; i++) embedding[i] /= norm;
  return embedding;
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-vec-test-${Date.now()}.db`);
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  try {
    fs.unlinkSync(dbPath);
    fs.unlinkSync(`${dbPath}-wal`);
    fs.unlinkSync(`${dbPath}-shm`);
  } catch {
    // cleanup best-effort
  }
});

describe('vector store', () => {
  it('inserts and searches chunks', () => {
    const paper = insertPaper(makePaper());
    const db = getDb();
    const embedding = makeMockEmbedding(1);

    insertChunkWithEmbedding(
      db,
      {
        paperId: paper.id,
        chunkType: 'title_abstract',
        chunkIndex: 0,
        chunkText: 'Test paper about AI',
        tokenCount: 5,
      },
      embedding,
    );

    const results = vectorSearch(db, embedding, 10);
    expect(results).toHaveLength(1);
    expect(results[0].paperId).toBe(paper.id);
    expect(results[0].chunkType).toBe('title_abstract');
    expect(results[0].distance).toBeCloseTo(0, 1);
  });

  it('deletes chunks for a paper', () => {
    const paper = insertPaper(makePaper());
    const db = getDb();

    insertChunkWithEmbedding(
      db,
      {
        paperId: paper.id,
        chunkType: 'title_abstract',
        chunkIndex: 0,
        chunkText: 'Test',
        tokenCount: 1,
      },
      makeMockEmbedding(1),
    );

    insertChunkWithEmbedding(
      db,
      {
        paperId: paper.id,
        chunkType: 'body',
        chunkIndex: 1,
        chunkText: 'Body text',
        tokenCount: 2,
      },
      makeMockEmbedding(2),
    );

    deleteChunksForPaper(db, paper.id);

    const results = vectorSearch(db, makeMockEmbedding(1), 10);
    expect(results).toHaveLength(0);
  });

  it('tracks embedding status', () => {
    const paper = insertPaper(makePaper());
    const db = getDb();

    setEmbeddingStatus(db, paper.id, 'indexing');
    let stats = getIndexingStats(db);
    expect(stats.totalPapers).toBe(1);
    expect(stats.indexed).toBe(0);

    setEmbeddingStatus(db, paper.id, 'complete', undefined, 3);
    stats = getIndexingStats(db);
    expect(stats.indexed).toBe(1);
    expect(stats.pending).toBe(0);
  });

  it('tracks failed status', () => {
    const paper = insertPaper(makePaper());
    const db = getDb();

    setEmbeddingStatus(db, paper.id, 'failed', 'Model load error');
    const stats = getIndexingStats(db);
    expect(stats.failed).toBe(1);
  });

  it('finds papers needing embedding', () => {
    const paper1 = insertPaper(makePaper({ arxivId: '1' }));
    const paper2 = insertPaper(makePaper({ arxivId: '2' }));
    const db = getDb();

    setEmbeddingStatus(db, paper1.id, 'complete', undefined, 1);
    // paper2 has no status — should need embedding

    const needsEmbedding = getPapersNeedingEmbedding(db);
    expect(needsEmbedding).toHaveLength(1);
    expect(needsEmbedding[0].id).toBe(paper2.id);
  });

  it('finds failed papers for re-indexing', () => {
    const paper = insertPaper(makePaper());
    const db = getDb();

    setEmbeddingStatus(db, paper.id, 'failed', 'Error');

    const needsEmbedding = getPapersNeedingEmbedding(db);
    expect(needsEmbedding).toHaveLength(1);
    expect(needsEmbedding[0].id).toBe(paper.id);
  });

  it('returns correct indexing stats', () => {
    const db = getDb();
    insertPaper(makePaper({ arxivId: '1' }));
    insertPaper(makePaper({ arxivId: '2' }));
    insertPaper(makePaper({ arxivId: '3' }));

    const paper1 = insertPaper(makePaper({ arxivId: '4' }));
    setEmbeddingStatus(db, paper1.id, 'complete', undefined, 2);

    const stats = getIndexingStats(db);
    expect(stats.totalPapers).toBe(4);
    expect(stats.indexed).toBe(1);
    expect(stats.pending).toBe(3);
    expect(stats.failed).toBe(0);
  });

  it('returns embedding status for multiple papers', () => {
    const db = getDb();
    const paper1 = insertPaper(makePaper({ arxivId: '1' }));
    const paper2 = insertPaper(makePaper({ arxivId: '2' }));
    const paper3 = insertPaper(makePaper({ arxivId: '3' }));

    setEmbeddingStatus(db, paper1.id, 'complete', undefined, 3);
    setEmbeddingStatus(db, paper2.id, 'failed', 'Some error');
    // paper3 has no status row

    const statusMap = getEmbeddingStatusForPapers(db, [paper1.id, paper2.id, paper3.id]);
    expect(statusMap.get(paper1.id)).toBe('complete');
    expect(statusMap.get(paper2.id)).toBe('failed');
    expect(statusMap.has(paper3.id)).toBe(false);
  });

  it('returns empty map for empty paper ids', () => {
    const db = getDb();
    const statusMap = getEmbeddingStatusForPapers(db, []);
    expect(statusMap.size).toBe(0);
  });

  it('does not include papers with no embedding_status row', () => {
    const db = getDb();
    const paper = insertPaper(makePaper());
    const statusMap = getEmbeddingStatusForPapers(db, [paper.id]);
    expect(statusMap.has(paper.id)).toBe(false);
  });

  it('cascade deletes chunks when paper is deleted', () => {
    const paper = insertPaper(makePaper());
    const db = getDb();

    insertChunkWithEmbedding(
      db,
      {
        paperId: paper.id,
        chunkType: 'title_abstract',
        chunkIndex: 0,
        chunkText: 'Test',
        tokenCount: 1,
      },
      makeMockEmbedding(1),
    );
    setEmbeddingStatus(db, paper.id, 'complete', undefined, 1);

    // Delete the paper — paper_chunks should cascade delete
    db.prepare('DELETE FROM papers WHERE id = ?').run(paper.id);

    const chunkRows = db.prepare('SELECT COUNT(*) as count FROM paper_chunks').get() as { count: number };
    expect(chunkRows.count).toBe(0);

    const statusRows = db.prepare('SELECT COUNT(*) as count FROM embedding_status').get() as { count: number };
    expect(statusRows.count).toBe(0);
  });
});
