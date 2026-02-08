import { XMLParser } from 'fast-xml-parser';
import type { ArxivPaper } from '../shared/types';

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

export async function searchArxiv(query: string, maxResults = 20): Promise<ArxivPaper[]> {
  const url = `${ARXIV_API_URL}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ArXiv API error: ${response.status}`);
  }

  const xml = await response.text();
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
