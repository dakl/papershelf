import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import { closeDatabase, initDatabase, insertPaper } from '../database';
import { deletePaper } from '../db/papers';
import { getViewerState, saveViewerState } from '../db/viewer-state';

let dbPath: string;

function makePaper(overrides: Partial<Parameters<typeof insertPaper>[0]> = {}) {
  return {
    arxivId: '2401.00001',
    title: 'Test Paper',
    authors: ['Author One'],
    abstract: 'Abstract text.',
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

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-viewer-state-test-${Date.now()}.db`);
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

describe('viewer-state', () => {
  it('returns null for unsaved paper', () => {
    const paper = insertPaper(makePaper());
    expect(getViewerState(paper.id)).toBeNull();
  });

  it('saves and retrieves state', () => {
    const paper = insertPaper(makePaper());
    saveViewerState(paper.id, 1.5, 200, 50);

    const state = getViewerState(paper.id);
    expect(state).toEqual({
      paperId: paper.id,
      scale: 1.5,
      scrollTop: 200,
      scrollLeft: 50,
    });
  });

  it('upserts on repeated saves', () => {
    const paper = insertPaper(makePaper());
    saveViewerState(paper.id, 1.0, 100, 0);
    saveViewerState(paper.id, 2.0, 300, 75);

    const state = getViewerState(paper.id);
    expect(state).toEqual({
      paperId: paper.id,
      scale: 2.0,
      scrollTop: 300,
      scrollLeft: 75,
    });
  });

  it('cascade deletes when paper is deleted', () => {
    const paper = insertPaper(makePaper());
    saveViewerState(paper.id, 1.5, 200, 50);
    expect(getViewerState(paper.id)).not.toBeNull();

    deletePaper(paper.id);
    expect(getViewerState(paper.id)).toBeNull();
  });
});
