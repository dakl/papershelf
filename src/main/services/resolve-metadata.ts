import type { PaperMetadataUpdate } from '../../shared/types';
import { rateLimitedFetch } from '../arxiv/rate-limiter';
import { updatePaperMetadata } from '../db/papers';
import { DataChangeEvent, eventEmitter } from '../event-emitter';

const MATCH_THRESHOLD = 0.85;

// --- Title similarity ---

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(str: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    result.add(str.slice(i, i + 2));
  }
  return result;
}

export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export function titleMatchScore(queryTitle: string, candidateTitle: string): number {
  return diceCoefficient(normalizeTitle(queryTitle), normalizeTitle(candidateTitle));
}

// --- CrossRef ---

interface CrossRefWork {
  DOI: string;
  title?: string[];
  author?: Array<{ given?: string; family: string }>;
  abstract?: string;
  'published-print'?: { 'date-parts': number[][] };
  'published-online'?: { 'date-parts': number[][] };
  subject?: string[];
}

function stripXmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function crossRefDateToIso(dateParts: number[][] | undefined): string | undefined {
  if (!dateParts || dateParts.length === 0) return undefined;
  const parts = dateParts[0];
  if (!parts || parts.length === 0) return undefined;
  const year = parts[0];
  const month = parts.length > 1 ? String(parts[1]).padStart(2, '0') : '01';
  const day = parts.length > 2 ? String(parts[2]).padStart(2, '0') : '01';
  return `${year}-${month}-${day}T00:00:00Z`;
}

export async function queryCrossRef(title: string): Promise<PaperMetadataUpdate | null> {
  const encodedTitle = encodeURIComponent(title);
  const url = `https://api.crossref.org/works?query.bibliographic=${encodedTitle}&select=DOI,title,author,abstract,published-print,published-online,subject&rows=3&mailto=papershelf@klevebring.se`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const items: CrossRefWork[] = data?.message?.items;
  if (!items || items.length === 0) return null;

  for (const item of items) {
    const candidateTitle = item.title?.[0];
    if (!candidateTitle) continue;

    const score = titleMatchScore(title, candidateTitle);
    if (score < MATCH_THRESHOLD) continue;

    const authors = (item.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' '));
    const abstract = item.abstract ? stripXmlTags(item.abstract) : undefined;
    const publishedDate =
      crossRefDateToIso(item['published-print']?.['date-parts']) ??
      crossRefDateToIso(item['published-online']?.['date-parts']);
    const categories = item.subject ?? undefined;

    return {
      title: candidateTitle,
      authors: authors.length > 0 ? authors : undefined,
      abstract,
      publishedDate,
      doi: item.DOI,
      categories,
    };
  }

  return null;
}

// --- Semantic Scholar ---

interface SemanticScholarPaper {
  title: string;
  authors?: Array<{ name: string }>;
  abstract?: string | null;
  publicationDate?: string | null;
  externalIds?: { DOI?: string; ArXiv?: string };
}

export async function querySemanticScholar(title: string): Promise<PaperMetadataUpdate | null> {
  const encodedTitle = encodeURIComponent(title);
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedTitle}&fields=title,authors,abstract,publicationDate,externalIds&limit=3`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const papers: SemanticScholarPaper[] = data?.data;
  if (!papers || papers.length === 0) return null;

  for (const paper of papers) {
    if (!paper.title) continue;

    const score = titleMatchScore(title, paper.title);
    if (score < MATCH_THRESHOLD) continue;

    const authors = paper.authors?.map((a) => a.name).filter(Boolean);
    const publishedDate = paper.publicationDate ? `${paper.publicationDate}T00:00:00Z` : undefined;

    return {
      title: paper.title,
      authors: authors && authors.length > 0 ? authors : undefined,
      abstract: paper.abstract ?? undefined,
      publishedDate,
      doi: paper.externalIds?.DOI ?? undefined,
      categories: undefined,
    };
  }

  return null;
}

// --- Orchestration ---

export interface ResolveResult {
  updates: PaperMetadataUpdate;
  source: 'crossref' | 'semantic-scholar';
}

export async function resolveMetadata(title: string): Promise<ResolveResult | null> {
  try {
    const crossRefResult = await queryCrossRef(title);
    if (crossRefResult) {
      return { updates: crossRefResult, source: 'crossref' };
    }
  } catch {
    // CrossRef failed, try Semantic Scholar
  }

  try {
    const semanticScholarResult = await querySemanticScholar(title);
    if (semanticScholarResult) {
      return { updates: semanticScholarResult, source: 'semantic-scholar' };
    }
  } catch {
    // Semantic Scholar also failed
  }

  return null;
}

export async function resolveMetadataForPapers(papers: Array<{ id: string; title: string }>): Promise<void> {
  for (const paper of papers) {
    eventEmitter.emit(DataChangeEvent.METADATA_RESOLUTION_PROGRESS, {
      paperId: paper.id,
      status: 'resolving',
    });

    try {
      const result = await resolveMetadata(paper.title);
      if (result) {
        // Strip undefined values so updatePaperMetadata only touches fields we have
        const cleanUpdates: PaperMetadataUpdate = {};
        if (result.updates.title !== undefined) cleanUpdates.title = result.updates.title;
        if (result.updates.authors !== undefined) cleanUpdates.authors = result.updates.authors;
        if (result.updates.abstract !== undefined) cleanUpdates.abstract = result.updates.abstract;
        if (result.updates.publishedDate !== undefined) cleanUpdates.publishedDate = result.updates.publishedDate;
        if (result.updates.doi !== undefined) cleanUpdates.doi = result.updates.doi;
        if (result.updates.categories !== undefined) cleanUpdates.categories = result.updates.categories;

        updatePaperMetadata(paper.id, cleanUpdates);
        eventEmitter.emit(DataChangeEvent.METADATA_RESOLUTION_PROGRESS, {
          paperId: paper.id,
          status: 'resolved',
          source: result.source,
        });
      } else {
        eventEmitter.emit(DataChangeEvent.METADATA_RESOLUTION_PROGRESS, {
          paperId: paper.id,
          status: 'no-match',
        });
      }
    } catch {
      eventEmitter.emit(DataChangeEvent.METADATA_RESOLUTION_PROGRESS, {
        paperId: paper.id,
        status: 'failed',
      });
    }
  }
}
