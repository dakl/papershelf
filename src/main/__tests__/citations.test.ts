import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import {
  closeDatabase,
  getCitationFetchTime,
  getCitationGraph,
  getCitationSubgraph,
  getS2IdsByArxivIds,
  initDatabase,
  insertPaper,
  saveCitationBatch,
} from '../database';

let dbPath: string;

function makePaper(overrides: Record<string, unknown> = {}) {
  return {
    arxivId: '2401.00001',
    title: 'Test Paper',
    authors: ['Author One'],
    abstract: 'Abstract',
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

function makeS2Paper(s2Id: string, arxivId: string | null = null) {
  return {
    s2Id,
    arxivId,
    title: `Paper ${s2Id}`,
    authors: ['Author'],
    year: 2024,
  };
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-citations-test-${Date.now()}.db`);
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

describe('saveCitationBatch', () => {
  it('saves paper with references and citations', () => {
    const center = makeS2Paper('center1', '2401.00001');
    const ref1 = makeS2Paper('ref1');
    const ref2 = makeS2Paper('ref2');
    const cit1 = makeS2Paper('cit1');

    saveCitationBatch(center, [ref1, ref2], [cit1], '2401.00001');

    const graph = getCitationGraph();
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);

    // center cites ref1 and ref2
    expect(graph.edges).toContainEqual({ source: 'center1', target: 'ref1' });
    expect(graph.edges).toContainEqual({ source: 'center1', target: 'ref2' });
    // cit1 cites center
    expect(graph.edges).toContainEqual({ source: 'cit1', target: 'center1' });
  });

  it('logs fetch time when arxivId is provided', () => {
    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [], [], '2401.00001');

    const fetchTime = getCitationFetchTime('2401.00001');
    expect(fetchTime).not.toBeNull();
  });

  it('does not log fetch time when arxivId is omitted', () => {
    saveCitationBatch(makeS2Paper('s1'), [], []);

    const fetchTime = getCitationFetchTime('2401.00001');
    expect(fetchTime).toBeNull();
  });

  it('upserts papers on conflict', () => {
    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [], [], '2401.00001');
    saveCitationBatch(
      { s2Id: 's1', arxivId: '2401.00001', title: 'Updated Title', authors: ['New Author'], year: 2025 },
      [],
      [],
      '2401.00001',
    );

    const graph = getCitationGraph();
    const node = graph.nodes.find((n) => n.semanticScholarId === 's1');
    expect(node!.title).toBe('Updated Title');
    expect(node!.year).toBe(2025);
  });

  it('deduplicates edges on repeated inserts', () => {
    const center = makeS2Paper('center1');
    const ref = makeS2Paper('ref1');

    saveCitationBatch(center, [ref], []);
    saveCitationBatch(center, [ref], []);

    const graph = getCitationGraph();
    expect(graph.edges).toHaveLength(1);
  });

  it('marks inLibrary for papers with matching arxivId', () => {
    insertPaper(makePaper({ arxivId: '2401.00001' }));
    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [makeS2Paper('s2')], []);

    const graph = getCitationGraph();
    const libraryNode = graph.nodes.find((n) => n.semanticScholarId === 's1');
    const externalNode = graph.nodes.find((n) => n.semanticScholarId === 's2');

    expect(libraryNode!.inLibrary).toBe(true);
    expect(externalNode!.inLibrary).toBe(false);
  });
});

describe('getS2IdsByArxivIds', () => {
  it('returns matching S2 IDs', () => {
    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [], [], '2401.00001');
    saveCitationBatch(makeS2Paper('s2', '2401.00002'), [], [], '2401.00002');

    const result = getS2IdsByArxivIds(['2401.00001', '2401.00002', '2401.99999']);
    expect(result).toContain('s1');
    expect(result).toContain('s2');
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(getS2IdsByArxivIds([])).toEqual([]);
  });
});

describe('getCitationSubgraph', () => {
  it('returns 1-hop neighborhood', () => {
    const center = makeS2Paper('center');
    const ref = makeS2Paper('ref');
    const cit = makeS2Paper('cit');
    saveCitationBatch(center, [ref], [cit]);

    const subgraph = getCitationSubgraph(['center']);
    expect(subgraph.nodes).toHaveLength(3);
    expect(subgraph.edges).toHaveLength(2);
  });

  it('returns empty for empty input', () => {
    const subgraph = getCitationSubgraph([]);
    expect(subgraph.nodes).toEqual([]);
    expect(subgraph.edges).toEqual([]);
  });

  it('includes center node even without edges', () => {
    saveCitationBatch(makeS2Paper('lonely'), [], []);

    const subgraph = getCitationSubgraph(['lonely']);
    expect(subgraph.nodes).toHaveLength(1);
    expect(subgraph.nodes[0].semanticScholarId).toBe('lonely');
  });
});

describe('getCitationFetchTime', () => {
  it('returns null for unfetched paper', () => {
    expect(getCitationFetchTime('unknown')).toBeNull();
  });

  it('updates fetch time on re-fetch', () => {
    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [], [], '2401.00001');
    const firstFetch = getCitationFetchTime('2401.00001');

    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [], [], '2401.00001');
    const secondFetch = getCitationFetchTime('2401.00001');

    expect(firstFetch).not.toBeNull();
    expect(secondFetch).not.toBeNull();
  });
});
