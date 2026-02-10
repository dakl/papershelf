const S2_API_BASE = 'https://api.semanticscholar.org/graph/v1/paper';
const FIELDS = 'paperId,externalIds,title,authors,year,references.paperId,references.externalIds,references.title,references.authors,references.year,citations.paperId,citations.externalIds,citations.title,citations.authors,citations.year';
const REQUEST_INTERVAL_MS = 350; // ~3 req/sec

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url);
}

interface S2Author {
  name: string;
}

interface S2PaperRef {
  paperId: string | null;
  externalIds?: { ArXiv?: string };
  title?: string;
  authors?: S2Author[];
  year?: number;
}

interface S2ApiResponse {
  paperId: string;
  externalIds?: { ArXiv?: string };
  title: string;
  authors: S2Author[];
  year: number | null;
  references: S2PaperRef[];
  citations: S2PaperRef[];
}

export interface S2Paper {
  s2Id: string;
  arxivId: string | null;
  title: string;
  authors: string[];
  year: number | null;
}

export interface CitationData {
  paper: S2Paper;
  references: S2Paper[];
  citations: S2Paper[];
}

function mapPaper(raw: S2PaperRef | S2ApiResponse): S2Paper | null {
  if (!raw.paperId) return null;
  return {
    s2Id: raw.paperId,
    arxivId: raw.externalIds?.ArXiv ?? null,
    title: raw.title ?? 'Unknown',
    authors: (raw.authors ?? []).map((a) => a.name),
    year: raw.year ?? null,
  };
}

export async function fetchCitationData(arxivId: string): Promise<CitationData | null> {
  const url = `${S2_API_BASE}/ARXIV:${arxivId}?fields=${FIELDS}`;
  const response = await rateLimitedFetch(url);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = (await response.json()) as S2ApiResponse;
  const paper = mapPaper(data);
  if (!paper) return null;

  const references = data.references
    .map(mapPaper)
    .filter((p): p is S2Paper => p !== null);

  const citations = data.citations
    .map(mapPaper)
    .filter((p): p is S2Paper => p !== null);

  return { paper, references, citations };
}

export async function fetchCitationDataByS2Id(s2Id: string): Promise<CitationData | null> {
  const url = `${S2_API_BASE}/${s2Id}?fields=${FIELDS}`;
  const response = await rateLimitedFetch(url);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = (await response.json()) as S2ApiResponse;
  const paper = mapPaper(data);
  if (!paper) return null;

  const references = data.references
    .map(mapPaper)
    .filter((p): p is S2Paper => p !== null);

  const citations = data.citations
    .map(mapPaper)
    .filter((p): p is S2Paper => p !== null);

  return { paper, references, citations };
}
