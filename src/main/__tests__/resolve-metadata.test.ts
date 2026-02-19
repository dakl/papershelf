import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock rateLimitedFetch before importing the module
const mockFetch = vi.fn();
vi.mock('../arxiv/rate-limiter', () => ({
  rateLimitedFetch: (...args: unknown[]) => mockFetch(...args),
}));

// Mock db functions
vi.mock('../db/papers', () => ({
  updatePaperMetadata: vi.fn(),
}));

vi.mock('../event-emitter', () => ({
  DataChangeEvent: { METADATA_RESOLUTION_PROGRESS: 'metadata:resolution-progress' },
  eventEmitter: { emit: vi.fn() },
}));

import {
  diceCoefficient,
  normalizeTitle,
  queryCrossRef,
  querySemanticScholar,
  resolveMetadata,
  titleMatchScore,
} from '../services/resolve-metadata';

describe('normalizeTitle', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeTitle('Hello, World!')).toBe('hello world');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeTitle('foo   bar   baz')).toBe('foo bar baz');
  });

  it('strips colons and hyphens', () => {
    expect(normalizeTitle('BERT: Pre-training of Deep Bidirectional Transformers')).toBe(
      'bert pretraining of deep bidirectional transformers',
    );
  });

  it('handles empty string', () => {
    expect(normalizeTitle('')).toBe('');
  });
});

describe('diceCoefficient', () => {
  it('returns 1 for identical strings', () => {
    expect(diceCoefficient('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(diceCoefficient('ab', 'cd')).toBe(0);
  });

  it('returns 0 for strings shorter than 2 chars', () => {
    expect(diceCoefficient('a', 'a')).toBe(1); // identical check
    expect(diceCoefficient('a', 'b')).toBe(0);
  });

  it('returns expected score for known inputs', () => {
    const score = diceCoefficient('night', 'nacht');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe('titleMatchScore', () => {
  it('returns high score for same title with different casing', () => {
    const score = titleMatchScore('Attention Is All You Need', 'attention is all you need');
    expect(score).toBe(1);
  });

  it('returns high score for minor punctuation differences', () => {
    const score = titleMatchScore(
      'BERT: Pre-training of Deep Bidirectional Transformers',
      'BERT : Pre-Training of Deep Bidirectional Transformers',
    );
    expect(score).toBeGreaterThan(0.9);
  });

  it('returns low score for unrelated titles', () => {
    const score = titleMatchScore('Attention Is All You Need', 'The Great Gatsby');
    expect(score).toBeLessThan(0.3);
  });
});

describe('queryCrossRef', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns metadata for a matching result', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          items: [
            {
              DOI: '10.1234/test',
              title: ['Attention Is All You Need'],
              author: [
                { given: 'Ashish', family: 'Vaswani' },
                { given: 'Noam', family: 'Shazeer' },
              ],
              abstract: '<jats:p>We propose a new architecture.</jats:p>',
              'published-print': { 'date-parts': [[2017, 6, 12]] },
              subject: ['Computer Science'],
            },
          ],
        },
      }),
    });

    const result = await queryCrossRef('Attention Is All You Need');
    expect(result).not.toBeNull();
    expect(result?.doi).toBe('10.1234/test');
    expect(result?.title).toBe('Attention Is All You Need');
    expect(result?.authors).toEqual(['Ashish Vaswani', 'Noam Shazeer']);
    expect(result?.abstract).toBe('We propose a new architecture.');
    expect(result?.publishedDate).toBe('2017-06-12T00:00:00Z');
    expect(result?.categories).toEqual(['Computer Science']);
  });

  it('returns null when no results match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          items: [
            {
              DOI: '10.1234/wrong',
              title: ['Completely Different Paper Title About Astrophysics'],
              author: [],
            },
          ],
        },
      }),
    });

    const result = await queryCrossRef('Attention Is All You Need');
    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await queryCrossRef('Test');
    expect(result).toBeNull();
  });
});

describe('querySemanticScholar', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns metadata for a matching result', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            title: 'Attention Is All You Need',
            authors: [{ name: 'Ashish Vaswani' }, { name: 'Noam Shazeer' }],
            abstract: 'The dominant sequence transduction models...',
            publicationDate: '2017-06-12',
            externalIds: { DOI: '10.1234/test', ArXiv: '1706.03762' },
          },
        ],
      }),
    });

    const result = await querySemanticScholar('Attention Is All You Need');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Attention Is All You Need');
    expect(result?.authors).toEqual(['Ashish Vaswani', 'Noam Shazeer']);
    expect(result?.abstract).toBe('The dominant sequence transduction models...');
    expect(result?.doi).toBe('10.1234/test');
  });

  it('returns null when no results match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            title: 'Something Completely Different',
            authors: [],
            abstract: null,
            publicationDate: null,
            externalIds: {},
          },
        ],
      }),
    });

    const result = await querySemanticScholar('Attention Is All You Need');
    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    const result = await querySemanticScholar('Test');
    expect(result).toBeNull();
  });
});

describe('resolveMetadata', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns crossref result when CrossRef matches', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          items: [
            {
              DOI: '10.1234/test',
              title: ['Attention Is All You Need'],
              author: [{ given: 'Ashish', family: 'Vaswani' }],
              abstract: 'Abstract text',
              'published-print': { 'date-parts': [[2017, 6]] },
            },
          ],
        },
      }),
    });

    const result = await resolveMetadata('Attention Is All You Need');
    expect(result).not.toBeNull();
    expect(result?.source).toBe('crossref');
    expect(result?.updates.doi).toBe('10.1234/test');
    // Should only call CrossRef, not Semantic Scholar
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to Semantic Scholar when CrossRef has no match', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('crossref')) {
        return { ok: true, json: async () => ({ message: { items: [] } }) };
      }
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              title: 'Attention Is All You Need',
              authors: [{ name: 'Vaswani' }],
              abstract: 'S2 abstract',
              publicationDate: '2017-06-12',
              externalIds: { DOI: '10.5678/s2' },
            },
          ],
        }),
      };
    });

    const result = await resolveMetadata('Attention Is All You Need');
    expect(result).not.toBeNull();
    expect(result?.source).toBe('semantic-scholar');
    expect(callCount).toBe(2);
  });

  it('returns null when both APIs have no match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { items: [] }, data: [] }),
    });

    // Need to handle both API responses separately
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('crossref')) {
        return { ok: true, json: async () => ({ message: { items: [] } }) };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    });

    const result = await resolveMetadata('xyzzy1234nonexistent');
    expect(result).toBeNull();
  });
});
