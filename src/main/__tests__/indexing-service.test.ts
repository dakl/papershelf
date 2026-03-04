import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

vi.mock('../services/embedding-service', () => ({
  embedDocumentTexts: vi.fn(),
  ensureModelLoaded: vi.fn().mockResolvedValue(undefined),
}));

import { closeDatabase, initDatabase } from '../database';
import { getDb } from '../db/connection';
import { insertPaper } from '../db/papers';
import { getEmbeddingStatusForPapers, getPapersNeedingEmbedding, setEmbeddingStatus } from '../db/vector-store';
import { DataChangeEvent, eventEmitter } from '../event-emitter';
import { embedDocumentTexts } from '../services/embedding-service';
import { indexAllPapers, indexPaper } from '../services/indexing-service';

let dbPath: string;

function makePaper(overrides: Partial<Parameters<typeof insertPaper>[0]> = {}) {
  return {
    arxivId: null as string | null,
    title: 'Test Paper',
    authors: ['Author One'],
    abstract: 'Test abstract about machine learning.',
    publishedDate: '2024-01-01T00:00:00Z',
    updatedDate: '2024-01-01T00:00:00Z',
    categories: ['cs.AI'],
    arxivUrl: '',
    pdfUrl: '',
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
  let norm = 0;
  for (const v of embedding) norm += v * v;
  norm = Math.sqrt(norm);
  for (let i = 0; i < 256; i++) embedding[i] /= norm;
  return embedding;
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-idx-test-${Date.now()}.db`);
  initDatabase(dbPath);
  vi.clearAllMocks();
});

afterEach(() => {
  closeDatabase();
  eventEmitter.removeAllListeners();
  try {
    fs.unlinkSync(dbPath);
    fs.unlinkSync(`${dbPath}-wal`);
    fs.unlinkSync(`${dbPath}-shm`);
  } catch {
    // cleanup best-effort
  }
});

describe('indexPaper', () => {
  it('indexes a paper and sets status to complete', async () => {
    const paper = insertPaper(makePaper({ arxivId: '1', title: 'ML Paper', abstract: 'About ML.' }));
    const db = getDb();
    const mockEmbed = vi.mocked(embedDocumentTexts);
    mockEmbed.mockResolvedValue([makeMockEmbedding(1)]);

    await indexPaper(paper.id);

    const statusMap = getEmbeddingStatusForPapers(db, [paper.id]);
    expect(statusMap.get(paper.id)).toBe('complete');

    const chunks = db.prepare('SELECT COUNT(*) as count FROM paper_chunks WHERE paper_id = ?').get(paper.id) as {
      count: number;
    };
    expect(chunks.count).toBeGreaterThan(0);
  });

  it('sets status to failed when embedding throws', async () => {
    const paper = insertPaper(makePaper({ arxivId: '2' }));
    const db = getDb();
    const mockEmbed = vi.mocked(embedDocumentTexts);
    mockEmbed.mockRejectedValue(new Error('Worker crashed'));

    await expect(indexPaper(paper.id)).rejects.toThrow('Worker crashed');

    const statusMap = getEmbeddingStatusForPapers(db, [paper.id]);
    expect(statusMap.get(paper.id)).toBe('failed');
  });

  it('clears old chunks on re-index', async () => {
    const paper = insertPaper(makePaper({ arxivId: '3', title: 'Reindex Me', abstract: 'Abstract.' }));
    const db = getDb();
    const mockEmbed = vi.mocked(embedDocumentTexts);
    mockEmbed.mockResolvedValue([makeMockEmbedding(1)]);

    await indexPaper(paper.id);
    const firstCount = (
      db.prepare('SELECT COUNT(*) as count FROM paper_chunks WHERE paper_id = ?').get(paper.id) as { count: number }
    ).count;

    // Re-index — old chunks should be deleted first
    mockEmbed.mockResolvedValue([makeMockEmbedding(2)]);
    await indexPaper(paper.id);

    const secondCount = (
      db.prepare('SELECT COUNT(*) as count FROM paper_chunks WHERE paper_id = ?').get(paper.id) as { count: number }
    ).count;
    expect(secondCount).toBe(firstCount);
  });

  it('skips paper that does not exist', async () => {
    const mockEmbed = vi.mocked(embedDocumentTexts);
    await indexPaper('nonexistent-id');
    expect(mockEmbed).not.toHaveBeenCalled();
  });
});

describe('indexAllPapers', () => {
  it('emits indexing → indexed → complete events for each paper', async () => {
    insertPaper(makePaper({ arxivId: '10', title: 'Paper A', abstract: 'About A.' }));
    insertPaper(makePaper({ arxivId: '11', title: 'Paper B', abstract: 'About B.' }));

    const mockEmbed = vi.mocked(embedDocumentTexts);
    mockEmbed.mockResolvedValue([makeMockEmbedding(1)]);

    const events: { status: string; paperId: string; current: number; total: number }[] = [];
    eventEmitter.on(DataChangeEvent.INDEXING_PROGRESS, (event) => {
      events.push({
        status: event.status,
        paperId: event.paperId,
        current: event.current,
        total: event.total,
      });
    });

    await indexAllPapers();

    // Should have: indexing(A), indexed(A), indexing(B), indexed(B), complete
    expect(events).toHaveLength(5);
    expect(events[0].status).toBe('indexing');
    expect(events[0].current).toBe(1);
    expect(events[0].total).toBe(2);

    expect(events[1].status).toBe('indexed');
    expect(events[1].current).toBe(1);

    expect(events[2].status).toBe('indexing');
    expect(events[2].current).toBe(2);

    expect(events[3].status).toBe('indexed');
    expect(events[3].current).toBe(2);

    expect(events[4].status).toBe('complete');
    expect(events[4].current).toBe(2);
    expect(events[4].total).toBe(2);
  });

  it('emits error event for failed papers but continues to next paper', async () => {
    const paperA = insertPaper(makePaper({ arxivId: '20', title: 'Paper A', abstract: 'About A.' }));
    insertPaper(makePaper({ arxivId: '21', title: 'Paper B', abstract: 'About B.' }));

    const mockEmbed = vi.mocked(embedDocumentTexts);
    // Fail consistently for paper A (odd calls), succeed for paper B (even calls)
    let callCount = 0;
    mockEmbed.mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 1) {
        throw new Error('Embedding failed');
      }
      return [makeMockEmbedding(1)];
    });

    const events: { status: string; paperId: string; error?: string }[] = [];
    eventEmitter.on(DataChangeEvent.INDEXING_PROGRESS, (event) => {
      events.push({ status: event.status, paperId: event.paperId, error: event.error });
    });

    await indexAllPapers();

    // First round: Paper A fails, Paper B succeeds
    const errorEvents = events.filter((e) => e.status === 'error');
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents[0].paperId).toBe(paperA.id);
    expect(errorEvents[0].error).toBe('Embedding failed');

    const indexedEvents = events.filter((e) => e.status === 'indexed');
    expect(indexedEvents.length).toBeGreaterThanOrEqual(1);

    const completeEvents = events.filter((e) => e.status === 'complete');
    expect(completeEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('skips papers that are already indexed', async () => {
    const paper1 = insertPaper(makePaper({ arxivId: '30', title: 'Already Done' }));
    insertPaper(makePaper({ arxivId: '31', title: 'Needs Index', abstract: 'About something.' }));
    const db = getDb();

    setEmbeddingStatus(db, paper1.id, 'complete', undefined, 1);

    const mockEmbed = vi.mocked(embedDocumentTexts);
    mockEmbed.mockResolvedValue([makeMockEmbedding(1)]);

    const events: { status: string }[] = [];
    eventEmitter.on(DataChangeEvent.INDEXING_PROGRESS, (event) => {
      events.push({ status: event.status });
    });

    await indexAllPapers();

    // Only 1 paper needs indexing, so: indexing, indexed, complete
    expect(events).toHaveLength(3);
    expect(mockEmbed).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no papers need indexing', async () => {
    const paper = insertPaper(makePaper({ arxivId: '40' }));
    const db = getDb();
    setEmbeddingStatus(db, paper.id, 'complete', undefined, 1);

    const mockEmbed = vi.mocked(embedDocumentTexts);

    const events: { status: string }[] = [];
    eventEmitter.on(DataChangeEvent.INDEXING_PROGRESS, (event) => {
      events.push({ status: event.status });
    });

    await indexAllPapers();

    expect(events).toHaveLength(0);
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it('follow-up does not retry failed papers (only picks up pending)', async () => {
    const paper = insertPaper(makePaper({ arxivId: '45', title: 'Will Fail', abstract: 'About failure.' }));
    const db = getDb();

    const mockEmbed = vi.mocked(embedDocumentTexts);
    mockEmbed.mockRejectedValue(new Error('Sharp not found'));

    const events: { status: string; paperId: string }[] = [];
    eventEmitter.on(DataChangeEvent.INDEXING_PROGRESS, (event) => {
      events.push({ status: event.status, paperId: event.paperId });
    });

    await indexAllPapers();

    // Paper should have failed
    const statusMap = getEmbeddingStatusForPapers(db, [paper.id]);
    expect(statusMap.get(paper.id)).toBe('failed');

    // The follow-up should NOT have re-triggered (paper is failed, not pending)
    // We expect exactly: indexing, error, complete — no second round
    const indexingEvents = events.filter((e) => e.status === 'indexing');
    expect(indexingEvents).toHaveLength(1);

    const completeEvents = events.filter((e) => e.status === 'complete');
    expect(completeEvents).toHaveLength(1);
  });

  it('re-indexes failed papers on subsequent call', async () => {
    const paper = insertPaper(makePaper({ arxivId: '50', title: 'Retry Me', abstract: 'About retry.' }));
    const db = getDb();

    setEmbeddingStatus(db, paper.id, 'failed', 'Previous error');

    const needsEmbedding = getPapersNeedingEmbedding(db);
    expect(needsEmbedding).toHaveLength(1);
    expect(needsEmbedding[0].id).toBe(paper.id);

    const mockEmbed = vi.mocked(embedDocumentTexts);
    mockEmbed.mockResolvedValue([makeMockEmbedding(1)]);

    await indexAllPapers();

    const statusMap = getEmbeddingStatusForPapers(db, [paper.id]);
    expect(statusMap.get(paper.id)).toBe('complete');
  });
});
