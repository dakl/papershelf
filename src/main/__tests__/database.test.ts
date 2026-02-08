import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import {
  initDatabase,
  closeDatabase,
  insertPaper,
  getPaperById,
  getPaperByArxivId,
  getPapers,
  deletePaper,
  toggleFavorite,
  checkPapersInLibrary,
  searchLibrary,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addPaperToCollection,
  removePaperFromCollection,
  getCollectionsForPaper,
  getTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToPaper,
  removeTagFromPaper,
  getTagsForPaper,
} from '../database';

let dbPath: string;

function makePaper(overrides: Partial<Parameters<typeof insertPaper>[0]> = {}) {
  return {
    arxivId: '2401.00001',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer'],
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
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
  dbPath = path.join(os.tmpdir(), `papershelf-test-${Date.now()}.db`);
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  try {
    fs.unlinkSync(dbPath);
    fs.unlinkSync(dbPath + '-wal');
    fs.unlinkSync(dbPath + '-shm');
  } catch {
    // cleanup best-effort
  }
});

// --- Papers ---

describe('papers', () => {
  it('inserts and retrieves a paper', () => {
    const paper = insertPaper(makePaper());

    expect(paper.arxivId).toBe('2401.00001');
    expect(paper.title).toBe('Attention Is All You Need');
    expect(paper.authors).toEqual(['Ashish Vaswani', 'Noam Shazeer']);
    expect(paper.categories).toEqual(['cs.CL', 'cs.AI']);
    expect(paper.isFavorite).toBe(false);
    expect(paper.collections).toEqual([]);
    expect(paper.tags).toEqual([]);
  });

  it('retrieves by id', () => {
    const paper = insertPaper(makePaper());
    const found = getPaperById(paper.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(paper.id);
    expect(found!.title).toBe('Attention Is All You Need');
  });

  it('retrieves by arxiv id', () => {
    insertPaper(makePaper());
    const found = getPaperByArxivId('2401.00001');

    expect(found).not.toBeNull();
    expect(found!.arxivId).toBe('2401.00001');
  });

  it('returns null for non-existent paper', () => {
    expect(getPaperById('nonexistent')).toBeNull();
    expect(getPaperByArxivId('nonexistent')).toBeNull();
  });

  it('enforces unique arxiv_id', () => {
    insertPaper(makePaper());
    expect(() => insertPaper(makePaper())).toThrow();
  });

  it('deletes a paper', () => {
    const paper = insertPaper(makePaper());
    deletePaper(paper.id);

    expect(getPaperById(paper.id)).toBeNull();
  });

  it('stores and retrieves pdf path and full text', () => {
    const paper = insertPaper(makePaper({
      pdfPath: '/path/to/paper.pdf',
      fullText: 'Full text of the paper goes here.',
    }));

    expect(paper.pdfPath).toBe('/path/to/paper.pdf');
    expect(paper.fullText).toBe('Full text of the paper goes here.');
  });
});

// --- Favorites ---

describe('favorites', () => {
  it('toggles favorite on', () => {
    const paper = insertPaper(makePaper());
    const result = toggleFavorite(paper.id);

    expect(result).toBe(true);
    expect(getPaperById(paper.id)!.isFavorite).toBe(true);
  });

  it('toggles favorite off', () => {
    const paper = insertPaper(makePaper());
    toggleFavorite(paper.id);
    const result = toggleFavorite(paper.id);

    expect(result).toBe(false);
    expect(getPaperById(paper.id)!.isFavorite).toBe(false);
  });

  it('throws for non-existent paper', () => {
    expect(() => toggleFavorite('nonexistent')).toThrow('Paper not found');
  });
});

// --- Paper filters ---

describe('getPapers', () => {
  it('returns all papers', () => {
    insertPaper(makePaper({ arxivId: '1' }));
    insertPaper(makePaper({ arxivId: '2' }));

    const papers = getPapers({ view: 'all-papers' });
    expect(papers).toHaveLength(2);
  });

  it('returns only favorites', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    insertPaper(makePaper({ arxivId: '2' }));
    toggleFavorite(p1.id);

    const papers = getPapers({ view: 'favorites' });
    expect(papers).toHaveLength(1);
    expect(papers[0].arxivId).toBe('1');
  });

  it('returns recent papers (limited to 50)', () => {
    insertPaper(makePaper({ arxivId: '1' }));
    const papers = getPapers({ view: 'recent' });
    expect(papers).toHaveLength(1);
  });

  it('filters by collection', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    insertPaper(makePaper({ arxivId: '2' }));
    const col = createCollection('ML', '#FF0000');
    addPaperToCollection(p1.id, col.id);

    const papers = getPapers({ view: 'collection', collectionId: col.id });
    expect(papers).toHaveLength(1);
    expect(papers[0].arxivId).toBe('1');
  });

  it('filters by tag', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    insertPaper(makePaper({ arxivId: '2' }));
    const tag = createTag('important', '#FF0000');
    addTagToPaper(p1.id, tag.id);

    const papers = getPapers({ view: 'tag', tagId: tag.id });
    expect(papers).toHaveLength(1);
    expect(papers[0].arxivId).toBe('1');
  });
});

// --- Check in library ---

describe('checkPapersInLibrary', () => {
  it('returns arxiv ids that are in the library', () => {
    insertPaper(makePaper({ arxivId: '1' }));
    insertPaper(makePaper({ arxivId: '2' }));

    const result = checkPapersInLibrary(['1', '2', '3']);
    expect(result).toEqual(expect.arrayContaining(['1', '2']));
    expect(result).not.toContain('3');
  });

  it('returns empty array for empty input', () => {
    expect(checkPapersInLibrary([])).toEqual([]);
  });
});

// --- FTS5 search ---

describe('searchLibrary', () => {
  it('finds papers by title', () => {
    insertPaper(makePaper({ title: 'Attention Is All You Need' }));
    insertPaper(makePaper({ arxivId: '2', title: 'BERT: Pre-training of Deep Bidirectional Transformers' }));

    const results = searchLibrary('attention');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Attention Is All You Need');
  });

  it('finds papers by abstract', () => {
    insertPaper(makePaper({ abstract: 'We propose a novel quantum computing algorithm.' }));

    const results = searchLibrary('quantum');
    expect(results).toHaveLength(1);
  });

  it('finds papers by full text', () => {
    insertPaper(makePaper({ fullText: 'This paper introduces a revolutionary approach to protein folding.' }));

    const results = searchLibrary('protein folding');
    expect(results).toHaveLength(1);
  });

  it('finds papers by author', () => {
    insertPaper(makePaper({ authors: ['Yann LeCun'] }));

    const results = searchLibrary('LeCun');
    expect(results).toHaveLength(1);
  });

  it('returns empty for no match', () => {
    insertPaper(makePaper());
    const results = searchLibrary('nonexistentterm12345');
    expect(results).toHaveLength(0);
  });
});

// --- Collections ---

describe('collections', () => {
  it('creates a collection', () => {
    const col = createCollection('Machine Learning', '#FF3B30');

    expect(col.name).toBe('Machine Learning');
    expect(col.color).toBe('#FF3B30');
    expect(col.paperCount).toBe(0);
  });

  it('lists collections', () => {
    createCollection('ML', '#FF0000');
    createCollection('NLP', '#00FF00');

    const cols = getCollections();
    expect(cols).toHaveLength(2);
  });

  it('updates a collection', () => {
    const col = createCollection('ML', '#FF0000');
    const updated = updateCollection(col.id, 'Machine Learning', '#0000FF');

    expect(updated.name).toBe('Machine Learning');
    expect(updated.color).toBe('#0000FF');
  });

  it('deletes a collection', () => {
    const col = createCollection('ML', '#FF0000');
    deleteCollection(col.id);

    expect(getCollections()).toHaveLength(0);
  });

  it('adds and removes paper from collection', () => {
    const paper = insertPaper(makePaper());
    const col = createCollection('ML', '#FF0000');

    addPaperToCollection(paper.id, col.id);
    expect(getCollectionsForPaper(paper.id)).toHaveLength(1);

    removePaperFromCollection(paper.id, col.id);
    expect(getCollectionsForPaper(paper.id)).toHaveLength(0);
  });

  it('duplicate add is idempotent', () => {
    const paper = insertPaper(makePaper());
    const col = createCollection('ML', '#FF0000');

    addPaperToCollection(paper.id, col.id);
    addPaperToCollection(paper.id, col.id);
    expect(getCollectionsForPaper(paper.id)).toHaveLength(1);
  });

  it('tracks paper count', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    const p2 = insertPaper(makePaper({ arxivId: '2' }));
    const col = createCollection('ML', '#FF0000');

    addPaperToCollection(p1.id, col.id);
    addPaperToCollection(p2.id, col.id);

    const cols = getCollections();
    expect(cols[0].paperCount).toBe(2);
  });

  it('cascade deletes paper_collections when paper is deleted', () => {
    const paper = insertPaper(makePaper());
    const col = createCollection('ML', '#FF0000');
    addPaperToCollection(paper.id, col.id);

    deletePaper(paper.id);
    const cols = getCollections();
    expect(cols[0].paperCount).toBe(0);
  });

  it('cascade deletes paper_collections when collection is deleted', () => {
    const paper = insertPaper(makePaper());
    const col = createCollection('ML', '#FF0000');
    addPaperToCollection(paper.id, col.id);

    deleteCollection(col.id);
    expect(getCollectionsForPaper(paper.id)).toHaveLength(0);
  });
});

// --- Tags ---

describe('tags', () => {
  it('creates a tag', () => {
    const tag = createTag('important', '#FF3B30');

    expect(tag.name).toBe('important');
    expect(tag.color).toBe('#FF3B30');
    expect(tag.paperCount).toBe(0);
  });

  it('lists tags', () => {
    createTag('important', '#FF0000');
    createTag('to-read', '#00FF00');

    const tags = getTags();
    expect(tags).toHaveLength(2);
  });

  it('updates a tag', () => {
    const tag = createTag('important', '#FF0000');
    const updated = updateTag(tag.id, 'critical', '#0000FF');

    expect(updated.name).toBe('critical');
    expect(updated.color).toBe('#0000FF');
  });

  it('deletes a tag', () => {
    const tag = createTag('important', '#FF0000');
    deleteTag(tag.id);

    expect(getTags()).toHaveLength(0);
  });

  it('adds and removes tag from paper', () => {
    const paper = insertPaper(makePaper());
    const tag = createTag('important', '#FF0000');

    addTagToPaper(paper.id, tag.id);
    expect(getTagsForPaper(paper.id)).toHaveLength(1);

    removeTagFromPaper(paper.id, tag.id);
    expect(getTagsForPaper(paper.id)).toHaveLength(0);
  });

  it('duplicate add is idempotent', () => {
    const paper = insertPaper(makePaper());
    const tag = createTag('important', '#FF0000');

    addTagToPaper(paper.id, tag.id);
    addTagToPaper(paper.id, tag.id);
    expect(getTagsForPaper(paper.id)).toHaveLength(1);
  });

  it('tracks paper count', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    const p2 = insertPaper(makePaper({ arxivId: '2' }));
    const tag = createTag('important', '#FF0000');

    addTagToPaper(p1.id, tag.id);
    addTagToPaper(p2.id, tag.id);

    const tags = getTags();
    expect(tags[0].paperCount).toBe(2);
  });

  it('cascade deletes paper_tags when paper is deleted', () => {
    const paper = insertPaper(makePaper());
    const tag = createTag('important', '#FF0000');
    addTagToPaper(paper.id, tag.id);

    deletePaper(paper.id);
    const tags = getTags();
    expect(tags[0].paperCount).toBe(0);
  });

  it('cascade deletes paper_tags when tag is deleted', () => {
    const paper = insertPaper(makePaper());
    const tag = createTag('important', '#FF0000');
    addTagToPaper(paper.id, tag.id);

    deleteTag(tag.id);
    expect(getTagsForPaper(paper.id)).toHaveLength(0);
  });
});

// --- Papers with collections and tags ---

describe('papers with relations', () => {
  it('includes collections and tags when retrieving a paper', () => {
    const paper = insertPaper(makePaper());
    const col = createCollection('ML', '#FF0000');
    const tag = createTag('important', '#00FF00');

    addPaperToCollection(paper.id, col.id);
    addTagToPaper(paper.id, tag.id);

    const found = getPaperById(paper.id)!;
    expect(found.collections).toHaveLength(1);
    expect(found.collections[0].name).toBe('ML');
    expect(found.tags).toHaveLength(1);
    expect(found.tags[0].name).toBe('important');
  });

  it('includes collections and tags in filtered results', () => {
    const paper = insertPaper(makePaper());
    const col = createCollection('ML', '#FF0000');
    const tag = createTag('important', '#00FF00');
    addPaperToCollection(paper.id, col.id);
    addTagToPaper(paper.id, tag.id);

    const papers = getPapers({ view: 'all-papers' });
    expect(papers[0].collections).toHaveLength(1);
    expect(papers[0].tags).toHaveLength(1);
  });

  it('includes collections and tags in search results', () => {
    const paper = insertPaper(makePaper({ title: 'Unique Searchable Title XYZ' }));
    const col = createCollection('ML', '#FF0000');
    const tag = createTag('important', '#00FF00');
    addPaperToCollection(paper.id, col.id);
    addTagToPaper(paper.id, tag.id);

    const results = searchLibrary('Unique Searchable');
    expect(results).toHaveLength(1);
    expect(results[0].collections).toHaveLength(1);
    expect(results[0].tags).toHaveLength(1);
  });
});
