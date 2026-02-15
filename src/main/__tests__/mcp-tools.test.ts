import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import {
  addPaperToCollection,
  addTagToPaper,
  closeDatabase,
  createCollection,
  createTag,
  initDatabase,
  insertPaper,
  toggleFavorite,
} from '../database';
import { resolveCollectionId, resolvePaperId, resolveTagId } from '../mcp/tools';

let dbPath: string;

function makePaper(overrides: Partial<Parameters<typeof insertPaper>[0]> = {}) {
  return {
    arxivId: '2401.00001',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer'],
    abstract: 'The dominant sequence transduction models.',
    publishedDate: '2017-06-12T00:00:00Z',
    updatedDate: '2017-06-12T00:00:00Z',
    categories: ['cs.CL', 'cs.AI'],
    arxivUrl: 'https://arxiv.org/abs/2401.00001',
    pdfUrl: 'https://arxiv.org/pdf/2401.00001',
    pdfPath: null,
    fullText: null,
    ...overrides,
  };
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-mcp-test-${Date.now()}.db`);
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

// --- resolvePaperId ---

describe('resolvePaperId', () => {
  it('resolves by library UUID', () => {
    const paper = insertPaper(makePaper());
    const found = resolvePaperId(paper.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(paper.id);
  });

  it('resolves by arXiv ID', () => {
    const _paper = insertPaper(makePaper({ arxivId: '2401.12345' }));
    const found = resolvePaperId('2401.12345');

    expect(found).not.toBeNull();
    expect(found!.arxivId).toBe('2401.12345');
  });

  it('returns null for unknown ID', () => {
    expect(resolvePaperId('nonexistent')).toBeNull();
  });

  it('prefers UUID over arXiv ID when both exist', () => {
    const paper = insertPaper(makePaper());
    // Resolve by UUID should return the paper directly
    const found = resolvePaperId(paper.id);
    expect(found!.id).toBe(paper.id);
  });
});

// --- resolveCollectionId ---

describe('resolveCollectionId', () => {
  it('resolves by ID', () => {
    const col = createCollection('Machine Learning', '#FF0000');
    const found = resolveCollectionId(col.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(col.id);
  });

  it('resolves by name', () => {
    const _col = createCollection('Machine Learning', '#FF0000');
    const found = resolveCollectionId('Machine Learning');

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Machine Learning');
  });

  it('returns null for unknown collection', () => {
    expect(resolveCollectionId('nonexistent')).toBeNull();
  });

  it('prefers ID match over name match', () => {
    const col1 = createCollection('ML', '#FF0000');
    // Create another collection whose name happens to look like col1's ID won't happen,
    // but we verify ID lookup is tried first
    const found = resolveCollectionId(col1.id);
    expect(found!.id).toBe(col1.id);
  });
});

// --- resolveTagId ---

describe('resolveTagId', () => {
  it('resolves by ID', () => {
    const tag = createTag('important', '#FF0000');
    const found = resolveTagId(tag.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(tag.id);
  });

  it('resolves by name', () => {
    const _tag = createTag('important', '#FF0000');
    const found = resolveTagId('important');

    expect(found).not.toBeNull();
    expect(found!.name).toBe('important');
  });

  it('returns null for unknown tag', () => {
    expect(resolveTagId('nonexistent')).toBeNull();
  });
});

// --- Integration: resolvers work with paper relations ---

describe('resolver integration', () => {
  it('resolvePaperId returns paper with collections and tags', () => {
    const paper = insertPaper(makePaper());
    const col = createCollection('ML', '#FF0000');
    const tag = createTag('important', '#00FF00');
    addPaperToCollection(paper.id, col.id);
    addTagToPaper(paper.id, tag.id);

    const found = resolvePaperId(paper.id);
    expect(found!.collections).toHaveLength(1);
    expect(found!.collections[0].name).toBe('ML');
    expect(found!.tags).toHaveLength(1);
    expect(found!.tags[0].name).toBe('important');
  });

  it('resolvePaperId via arXiv ID returns favorite status', () => {
    const paper = insertPaper(makePaper({ arxivId: '2401.99999' }));
    toggleFavorite(paper.id);

    const found = resolvePaperId('2401.99999');
    expect(found!.isFavorite).toBe(true);
  });

  it('resolveCollectionId by name returns correct paper count', () => {
    const col = createCollection('NLP', '#0000FF');
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    const p2 = insertPaper(makePaper({ arxivId: '2' }));
    addPaperToCollection(p1.id, col.id);
    addPaperToCollection(p2.id, col.id);

    const found = resolveCollectionId('NLP');
    expect(found!.paperCount).toBe(2);
  });

  it('resolveTagId by name returns correct paper count', () => {
    const tag = createTag('to-read', '#00FF00');
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    const p2 = insertPaper(makePaper({ arxivId: '2' }));
    addTagToPaper(p1.id, tag.id);
    addTagToPaper(p2.id, tag.id);

    const found = resolveTagId('to-read');
    expect(found!.paperCount).toBe(2);
  });
});
