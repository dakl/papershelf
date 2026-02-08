import { XMLParser } from 'fast-xml-parser';
import type { ArxivPaper } from '../shared/types';
import { rateLimitedFetch } from './arxiv/rate-limiter';

const ARXIV_API_URL = 'https://export.arxiv.org/api/query';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function extractArxivId(idUrl: string): string {
  const match = idUrl.match(/abs\/(.+?)(?:v\d+)?$/);
  return match ? match[1] : idUrl;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export type ArxivSortBy = 'relevance' | 'lastUpdatedDate' | 'submittedDate';
export type ArxivSortOrder = 'ascending' | 'descending';

export interface SearchArxivOptions {
  query: string;
  maxResults?: number;
  sortBy?: ArxivSortBy;
  sortOrder?: ArxivSortOrder;
  categories?: string[];
}

function parseEntries(xml: string): ArxivPaper[] {
  const parsed = parser.parse(xml);
  const entries = toArray(parsed?.feed?.entry);
  if (entries.length === 0) return [];

  return entries.map((entry: Record<string, unknown>): ArxivPaper => {
    const authors = toArray(entry.author as Record<string, string> | Record<string, string>[])
      .map((a: Record<string, string>) => a.name);

    const categories = toArray(entry.category as Record<string, string> | Record<string, string>[])
      .map((c: Record<string, string>) => c['@_term']);

    const links = toArray(entry.link as Record<string, string> | Record<string, string>[]);
    const pdfLink = links.find((l: Record<string, string>) => l['@_title'] === 'pdf');

    return {
      id: extractArxivId(entry.id as string),
      title: cleanText(entry.title as string),
      authors,
      abstract: cleanText(entry.summary as string),
      publishedDate: entry.published as string,
      updatedDate: entry.updated as string,
      categories,
      arxivUrl: entry.id as string,
      pdfUrl: pdfLink ? (pdfLink['@_href'] as string) : '',
    };
  });
}

export async function searchArxiv(queryOrOptions: string | SearchArxivOptions, maxResults = 20): Promise<ArxivPaper[]> {
  let query: string;
  let max: number;
  let sortBy: ArxivSortBy | undefined;
  let sortOrder: ArxivSortOrder | undefined;
  let categories: string[] | undefined;

  if (typeof queryOrOptions === 'string') {
    query = queryOrOptions;
    max = maxResults;
  } else {
    query = queryOrOptions.query;
    max = queryOrOptions.maxResults ?? 20;
    sortBy = queryOrOptions.sortBy;
    sortOrder = queryOrOptions.sortOrder;
    categories = queryOrOptions.categories;
  }

  let searchQuery = `all:${encodeURIComponent(query)}`;
  if (categories && categories.length > 0) {
    const catQuery = categories.map((c) => `cat:${c}`).join('+OR+');
    searchQuery = `${searchQuery}+AND+%28${catQuery}%29`;
  }

  let url = `${ARXIV_API_URL}?search_query=${searchQuery}&start=0&max_results=${max}`;
  if (sortBy) url += `&sortBy=${sortBy}`;
  if (sortOrder) url += `&sortOrder=${sortOrder}`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(`ArXiv API error: ${response.status}`);
  }

  const xml = await response.text();
  return parseEntries(xml);
}
