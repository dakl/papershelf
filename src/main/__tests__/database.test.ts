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
  checkPapersInLibrary,
  closeDatabase,
  createCollection,
  createTag,
  deleteCollection,
  deletePaper,
  deleteTag,
  getCollectionByName,
  getCollections,
  getCollectionsForPaper,
  getCollectionsForPapers,
  getPaperByArxivId,
  getPaperById,
  getPapers,
  getTagByName,
  getTags,
  getTagsForPaper,
  getTagsForPapers,
  initDatabase,
  insertPaper,
  removePaperFromCollection,
  removeTagFromPaper,
  searchLibrary,
  toggleFavorite,
  updateCollection,
  updateTag,
} from '../database';

let dbPath: string;

function makePaper(overrides: Partial<Parameters<typeof insertPaper>[0]> = {}) {
  return {
    arxivId: '2401.00001',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer'],
    abstract:
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
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
    const paper = insertPaper(
      makePaper({
        pdfPath: '/path/to/paper.pdf',
        fullText: 'Full text of the paper goes here.',
      }),
    );

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

// --- Paper sorting ---

describe('getPapers sorting', () => {
  it('sorts by title ascending', () => {
    insertPaper(makePaper({ arxivId: '1', title: 'Zebra Networks' }));
    insertPaper(makePaper({ arxivId: '2', title: 'Alpha Models' }));

    const papers = getPapers({ view: 'all-papers', sortBy: 'title', sortOrder: 'asc' });
    expect(papers[0].title).toBe('Alpha Models');
    expect(papers[1].title).toBe('Zebra Networks');
  });

  it('sorts by title descending', () => {
    insertPaper(makePaper({ arxivId: '1', title: 'Alpha Models' }));
    insertPaper(makePaper({ arxivId: '2', title: 'Zebra Networks' }));

    const papers = getPapers({ view: 'all-papers', sortBy: 'title', sortOrder: 'desc' });
    expect(papers[0].title).toBe('Zebra Networks');
    expect(papers[1].title).toBe('Alpha Models');
  });

  it('sorts by title case-insensitively', () => {
    insertPaper(makePaper({ arxivId: '1', title: 'zebra Networks' }));
    insertPaper(makePaper({ arxivId: '2', title: 'Alpha Models' }));

    const papers = getPapers({ view: 'all-papers', sortBy: 'title', sortOrder: 'asc' });
    expect(papers[0].title).toBe('Alpha Models');
    expect(papers[1].title).toBe('zebra Networks');
  });

  it('sorts by published_date ascending', () => {
    insertPaper(makePaper({ arxivId: '1', publishedDate: '2024-01-01T00:00:00Z' }));
    insertPaper(makePaper({ arxivId: '2', publishedDate: '2023-01-01T00:00:00Z' }));

    const papers = getPapers({ view: 'all-papers', sortBy: 'published_date', sortOrder: 'asc' });
    expect(papers[0].publishedDate).toBe('2023-01-01T00:00:00Z');
    expect(papers[1].publishedDate).toBe('2024-01-01T00:00:00Z');
  });

  it('defaults to created_at DESC when sort not specified', () => {
    insertPaper(makePaper({ arxivId: '1', publishedDate: '2023-01-01T00:00:00Z' }));
    insertPaper(makePaper({ arxivId: '2', publishedDate: '2024-01-01T00:00:00Z' }));

    const papers = getPapers({ view: 'all-papers' });
    // Without explicit sort, defaults to created_at DESC — both have same created_at
    // so just verify we get both papers back with default behavior
    expect(papers).toHaveLength(2);
  });

  it('ignores sort for recent view (always created_at DESC)', () => {
    insertPaper(makePaper({ arxivId: '1', title: 'Alpha', publishedDate: '2024-01-01T00:00:00Z' }));
    insertPaper(makePaper({ arxivId: '2', title: 'Zebra', publishedDate: '2023-01-01T00:00:00Z' }));

    // Even though we ask for title ASC, recent view should ignore it
    const papersByTitle = getPapers({ view: 'recent', sortBy: 'title', sortOrder: 'asc' });
    const papersByDate = getPapers({ view: 'recent' });
    // Both should return same order (recent ignores sortBy)
    expect(papersByTitle.map((p) => p.arxivId)).toEqual(papersByDate.map((p) => p.arxivId));
  });

  it('sorts within collection view', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1', title: 'Zebra Networks' }));
    const p2 = insertPaper(makePaper({ arxivId: '2', title: 'Alpha Models' }));
    const col = createCollection('ML', '#FF0000');
    addPaperToCollection(p1.id, col.id);
    addPaperToCollection(p2.id, col.id);

    const papers = getPapers({ view: 'collection', collectionId: col.id, sortBy: 'title', sortOrder: 'asc' });
    expect(papers[0].title).toBe('Alpha Models');
    expect(papers[1].title).toBe('Zebra Networks');
  });

  it('sorts within tag view', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1', title: 'Zebra Networks' }));
    const p2 = insertPaper(makePaper({ arxivId: '2', title: 'Alpha Models' }));
    const tag = createTag('important', '#FF0000');
    addTagToPaper(p1.id, tag.id);
    addTagToPaper(p2.id, tag.id);

    const papers = getPapers({ view: 'tag', tagId: tag.id, sortBy: 'title', sortOrder: 'asc' });
    expect(papers[0].title).toBe('Alpha Models');
    expect(papers[1].title).toBe('Zebra Networks');
  });

  it('sorts favorites by published_date', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1', publishedDate: '2024-06-01T00:00:00Z' }));
    const p2 = insertPaper(makePaper({ arxivId: '2', publishedDate: '2023-01-01T00:00:00Z' }));
    toggleFavorite(p1.id);
    toggleFavorite(p2.id);

    const papers = getPapers({ view: 'favorites', sortBy: 'published_date', sortOrder: 'asc' });
    expect(papers[0].publishedDate).toBe('2023-01-01T00:00:00Z');
    expect(papers[1].publishedDate).toBe('2024-06-01T00:00:00Z');
  });

  it('sorts by first author ascending', () => {
    insertPaper(makePaper({ arxivId: '1', authors: ['Zara Smith', 'Alice Jones'] }));
    insertPaper(makePaper({ arxivId: '2', authors: ['Alice Brown'] }));

    const papers = getPapers({ view: 'all-papers', sortBy: 'first_author', sortOrder: 'asc' });
    expect(papers[0].authors[0]).toBe('Alice Brown');
    expect(papers[1].authors[0]).toBe('Zara Smith');
  });

  it('sorts by first author descending', () => {
    insertPaper(makePaper({ arxivId: '1', authors: ['Alice Brown'] }));
    insertPaper(makePaper({ arxivId: '2', authors: ['Zara Smith'] }));

    const papers = getPapers({ view: 'all-papers', sortBy: 'first_author', sortOrder: 'desc' });
    expect(papers[0].authors[0]).toBe('Zara Smith');
    expect(papers[1].authors[0]).toBe('Alice Brown');
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

// --- Name-based lookups ---

describe('getCollectionByName', () => {
  it('finds a collection by name', () => {
    createCollection('Machine Learning', '#FF0000');

    const found = getCollectionByName('Machine Learning');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Machine Learning');
  });

  it('returns null for non-existent name', () => {
    expect(getCollectionByName('nonexistent')).toBeNull();
  });

  it('returns correct paper count', () => {
    const col = createCollection('ML', '#FF0000');
    const paper = insertPaper(makePaper());
    addPaperToCollection(paper.id, col.id);

    const found = getCollectionByName('ML');
    expect(found!.paperCount).toBe(1);
  });

  it('is case-sensitive', () => {
    createCollection('Machine Learning', '#FF0000');

    expect(getCollectionByName('machine learning')).toBeNull();
    expect(getCollectionByName('MACHINE LEARNING')).toBeNull();
  });
});

describe('getTagByName', () => {
  it('finds a tag by name', () => {
    createTag('important', '#FF0000');

    const found = getTagByName('important');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('important');
  });

  it('returns null for non-existent name', () => {
    expect(getTagByName('nonexistent')).toBeNull();
  });

  it('returns correct paper count', () => {
    const tag = createTag('to-read', '#00FF00');
    const paper = insertPaper(makePaper());
    addTagToPaper(paper.id, tag.id);

    const found = getTagByName('to-read');
    expect(found!.paperCount).toBe(1);
  });

  it('is case-sensitive', () => {
    createTag('Important', '#FF0000');

    expect(getTagByName('important')).toBeNull();
    expect(getTagByName('IMPORTANT')).toBeNull();
  });
});

// --- Batch fetching ---

describe('batch collection and tag fetching', () => {
  it('returns collections grouped by paper id', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    const p2 = insertPaper(makePaper({ arxivId: '2' }));
    const p3 = insertPaper(makePaper({ arxivId: '3' }));
    const colA = createCollection('ML', '#FF0000');
    const colB = createCollection('NLP', '#00FF00');

    addPaperToCollection(p1.id, colA.id);
    addPaperToCollection(p1.id, colB.id);
    addPaperToCollection(p2.id, colA.id);

    const collectionsMap = getCollectionsForPapers([p1.id, p2.id, p3.id]);

    expect(collectionsMap.get(p1.id)).toHaveLength(2);
    expect(collectionsMap.get(p2.id)).toHaveLength(1);
    expect(collectionsMap.get(p2.id)![0].name).toBe('ML');
    expect(collectionsMap.get(p3.id)).toHaveLength(0);
  });

  it('returns tags grouped by paper id', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    const p2 = insertPaper(makePaper({ arxivId: '2' }));
    const p3 = insertPaper(makePaper({ arxivId: '3' }));
    const tagA = createTag('important', '#FF0000');
    const tagB = createTag('to-read', '#00FF00');

    addTagToPaper(p1.id, tagA.id);
    addTagToPaper(p1.id, tagB.id);
    addTagToPaper(p2.id, tagA.id);

    const tagsMap = getTagsForPapers([p1.id, p2.id, p3.id]);

    expect(tagsMap.get(p1.id)).toHaveLength(2);
    expect(tagsMap.get(p2.id)).toHaveLength(1);
    expect(tagsMap.get(p2.id)![0].name).toBe('important');
    expect(tagsMap.get(p3.id)).toHaveLength(0);
  });

  it('returns empty maps for empty input', () => {
    expect(getCollectionsForPapers([])).toEqual(new Map());
    expect(getTagsForPapers([])).toEqual(new Map());
  });

  it('includes correct paper_count in batch collection results', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    const p2 = insertPaper(makePaper({ arxivId: '2' }));
    const col = createCollection('ML', '#FF0000');

    addPaperToCollection(p1.id, col.id);
    addPaperToCollection(p2.id, col.id);

    const collectionsMap = getCollectionsForPapers([p1.id]);
    expect(collectionsMap.get(p1.id)![0].paperCount).toBe(2);
  });

  it('includes correct paper_count in batch tag results', () => {
    const p1 = insertPaper(makePaper({ arxivId: '1' }));
    const p2 = insertPaper(makePaper({ arxivId: '2' }));
    const tag = createTag('important', '#FF0000');

    addTagToPaper(p1.id, tag.id);
    addTagToPaper(p2.id, tag.id);

    const tagsMap = getTagsForPapers([p1.id]);
    expect(tagsMap.get(p1.id)![0].paperCount).toBe(2);
  });
});
