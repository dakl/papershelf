import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchArxiv } from '../arxiv-client';
import { fetchPaper } from '../arxiv/fetch-paper';
import { fetchPaperHtml } from '../arxiv/html';
import { ARXIV_CATEGORIES } from '../arxiv/categories';
import { downloadAndExtractPdf } from '../pdf-processor';
import * as db from '../database';
import type { LibraryPaper } from '../../shared/types';

function formatPaper(paper: LibraryPaper): string {
  return [
    `**${paper.title}**`,
    `Authors: ${paper.authors.join(', ')}`,
    `arXiv ID: ${paper.arxivId}`,
    `Published: ${paper.publishedDate}`,
    `Categories: ${paper.categories.join(', ')}`,
    `URL: ${paper.arxivUrl}`,
    paper.isFavorite ? 'Favorited' : '',
    paper.collections.length > 0 ? `Collections: ${paper.collections.map((c) => c.name).join(', ')}` : '',
    paper.tags.length > 0 ? `Tags: ${paper.tags.map((t) => t.name).join(', ')}` : '',
    '',
    paper.abstract,
  ].filter(Boolean).join('\n');
}

function generateBibtex(paper: LibraryPaper): string {
  const id = paper.arxivId.replace(/[/.]/g, '_');
  const year = paper.publishedDate ? new Date(paper.publishedDate).getFullYear() : 'unknown';
  const authors = paper.authors.join(' and ');
  const primaryCategory = paper.categories[0] || '';

  return [
    `@article{${id},`,
    `  title     = {${paper.title}},`,
    `  author    = {${authors}},`,
    `  year      = {${year}},`,
    `  eprint    = {${paper.arxivId}},`,
    `  archivePrefix = {arXiv},`,
    `  primaryClass  = {${primaryCategory}},`,
    `  url       = {${paper.arxivUrl}}`,
    `}`,
  ].join('\n');
}

export const TOOL_METADATA: { name: string; description: string }[] = [
  { name: 'search_arxiv', description: 'Search arXiv for papers by keyword, author, or topic' },
  { name: 'search_library', description: 'Full-text search across saved papers' },
  { name: 'get_paper', description: 'Get detailed info about a paper by ID' },
  { name: 'list_papers', description: 'List papers in the library' },
  { name: 'save_paper', description: 'Save an arXiv paper to the library' },
  { name: 'fetch_paper_html', description: 'Fetch full HTML content of an arXiv paper' },
  { name: 'get_bibtex', description: 'Generate a BibTeX citation for a paper' },
  { name: 'list_collections', description: 'List all collections' },
  { name: 'list_tags', description: 'List all tags' },
  { name: 'list_categories', description: 'List all arXiv categories' },
];

export function registerTools(server: McpServer, disabledTools: Set<string> = new Set()): void {
  const isEnabled = (name: string) => !disabledTools.has(name);

  // 1. search_arxiv
  if (isEnabled('search_arxiv')) server.tool(
    'search_arxiv',
    'Search arXiv for papers by keyword, author, or topic',
    {
      query: z.string().describe('Search query (keywords, author names, paper topics)'),
      max_results: z.number().min(1).max(50).default(10).describe('Maximum number of results'),
      sort_by: z.enum(['relevance', 'lastUpdatedDate', 'submittedDate']).default('relevance').describe('Sort order'),
      categories: z.array(z.string()).optional().describe('Filter by arXiv categories (e.g. ["cs.AI", "cs.CL"])'),
    },
    async ({ query, max_results, sort_by, categories }) => {
      const papers = await searchArxiv({
        query,
        maxResults: max_results,
        sortBy: sort_by,
        categories,
      });

      if (papers.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No papers found.' }] };
      }

      const text = papers.map((p, i) => [
        `### ${i + 1}. ${p.title}`,
        `Authors: ${p.authors.join(', ')}`,
        `arXiv ID: ${p.id} | Published: ${p.publishedDate}`,
        `Categories: ${p.categories.join(', ')}`,
        `URL: ${p.arxivUrl}`,
        '',
        p.abstract,
      ].join('\n')).join('\n\n---\n\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  // 2. search_library
  if (isEnabled('search_library')) server.tool(
    'search_library',
    'Full-text search across papers saved in the PaperShelf library',
    {
      query: z.string().describe('Search query for full-text search across titles, abstracts, authors, and paper content'),
    },
    async ({ query }) => {
      const papers = db.searchLibrary(query);

      if (papers.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No matching papers in library.' }] };
      }

      const text = papers.map((p, i) => `### ${i + 1}. ${formatPaper(p)}`).join('\n\n---\n\n');
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  // 3. get_paper
  if (isEnabled('get_paper')) server.tool(
    'get_paper',
    'Get detailed information about a paper by library ID or arXiv ID. Fetches from arXiv if not in library.',
    {
      id: z.string().describe('Library paper ID (UUID) or arXiv ID (e.g. "2401.00001")'),
    },
    async ({ id }) => {
      // Try library ID first
      let paper = db.getPaperById(id);
      if (paper) {
        return { content: [{ type: 'text' as const, text: formatPaper(paper) }] };
      }

      // Try arXiv ID in library
      paper = db.getPaperByArxivId(id);
      if (paper) {
        return { content: [{ type: 'text' as const, text: formatPaper(paper) }] };
      }

      // Fetch from arXiv API
      const arxivPaper = await fetchPaper(id);
      if (!arxivPaper) {
        return { content: [{ type: 'text' as const, text: `Paper not found: ${id}` }] };
      }

      const text = [
        `**${arxivPaper.title}** _(not in library)_`,
        `Authors: ${arxivPaper.authors.join(', ')}`,
        `arXiv ID: ${arxivPaper.id}`,
        `Published: ${arxivPaper.publishedDate}`,
        `Categories: ${arxivPaper.categories.join(', ')}`,
        `URL: ${arxivPaper.arxivUrl}`,
        '',
        arxivPaper.abstract,
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  // 4. list_papers
  if (isEnabled('list_papers')) server.tool(
    'list_papers',
    'List papers in the PaperShelf library, optionally filtered by view',
    {
      view: z.enum(['all-papers', 'favorites', 'recent']).default('all-papers').describe('Filter view'),
    },
    async ({ view }) => {
      const papers = db.getPapers({ view });

      if (papers.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No papers in library.' }] };
      }

      const text = papers.map((p, i) =>
        `${i + 1}. **${p.title}** — ${p.authors.slice(0, 3).join(', ')}${p.authors.length > 3 ? ' et al.' : ''} (${p.arxivId})${p.isFavorite ? ' ⭐' : ''}`
      ).join('\n');

      return { content: [{ type: 'text' as const, text: `${papers.length} papers:\n\n${text}` }] };
    },
  );

  // 5. save_paper
  if (isEnabled('save_paper')) server.tool(
    'save_paper',
    'Save an arXiv paper to the PaperShelf library (downloads PDF and extracts text)',
    {
      arxiv_id: z.string().describe('arXiv ID of the paper to save (e.g. "2401.00001")'),
    },
    async ({ arxiv_id }) => {
      const existing = db.getPaperByArxivId(arxiv_id);
      if (existing) {
        return { content: [{ type: 'text' as const, text: `Paper already in library: ${existing.title}` }] };
      }

      const arxivPaper = await fetchPaper(arxiv_id);
      if (!arxivPaper) {
        return { content: [{ type: 'text' as const, text: `Paper not found on arXiv: ${arxiv_id}` }] };
      }

      let pdfPath: string | null = null;
      let fullText: string | null = null;

      if (arxivPaper.pdfUrl) {
        try {
          const result = await downloadAndExtractPdf(arxivPaper.pdfUrl, arxivPaper.id);
          pdfPath = result.pdfPath;
          fullText = result.fullText;
        } catch {
          // Save paper even if PDF download fails
        }
      }

      const saved = db.insertPaper({
        arxivId: arxivPaper.id,
        title: arxivPaper.title,
        authors: arxivPaper.authors,
        abstract: arxivPaper.abstract,
        publishedDate: arxivPaper.publishedDate,
        updatedDate: arxivPaper.updatedDate,
        categories: arxivPaper.categories,
        arxivUrl: arxivPaper.arxivUrl,
        pdfUrl: arxivPaper.pdfUrl,
        pdfPath,
        fullText,
      });

      return { content: [{ type: 'text' as const, text: `Saved: ${saved.title}\nLibrary ID: ${saved.id}${pdfPath ? '\nPDF downloaded' : ''}${fullText ? ' and text extracted' : ''}` }] };
    },
  );

  // 6. fetch_paper_html
  if (isEnabled('fetch_paper_html')) server.tool(
    'fetch_paper_html',
    'Fetch the full HTML content of an arXiv paper as markdown (when available)',
    {
      arxiv_id: z.string().describe('arXiv ID of the paper (e.g. "2401.00001")'),
    },
    async ({ arxiv_id }) => {
      try {
        const markdown = await fetchPaperHtml(arxiv_id);
        return { content: [{ type: 'text' as const, text: markdown }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { content: [{ type: 'text' as const, text: `Failed to fetch HTML: ${msg}\n\nNote: Not all arXiv papers have HTML versions available.` }] };
      }
    },
  );

  // 7. get_bibtex
  if (isEnabled('get_bibtex')) server.tool(
    'get_bibtex',
    'Generate a BibTeX citation for a paper (by library ID or arXiv ID)',
    {
      id: z.string().describe('Library paper ID (UUID) or arXiv ID'),
    },
    async ({ id }) => {
      let paper = db.getPaperById(id) ?? db.getPaperByArxivId(id);

      if (!paper) {
        // Fetch from arXiv and create a temporary LibraryPaper-like object
        const arxivPaper = await fetchPaper(id);
        if (!arxivPaper) {
          return { content: [{ type: 'text' as const, text: `Paper not found: ${id}` }] };
        }
        paper = {
          id: '',
          arxivId: arxivPaper.id,
          title: arxivPaper.title,
          authors: arxivPaper.authors,
          abstract: arxivPaper.abstract,
          publishedDate: arxivPaper.publishedDate,
          updatedDate: arxivPaper.updatedDate,
          categories: arxivPaper.categories,
          arxivUrl: arxivPaper.arxivUrl,
          pdfUrl: arxivPaper.pdfUrl,
          pdfPath: null,
          fullText: null,
          isFavorite: false,
          createdAt: '',
          collections: [],
          tags: [],
        };
      }

      const bibtex = generateBibtex(paper);
      return { content: [{ type: 'text' as const, text: bibtex }] };
    },
  );

  // 8. list_collections
  if (isEnabled('list_collections')) server.tool(
    'list_collections',
    'List all collections in the PaperShelf library',
    {},
    async () => {
      const collections = db.getCollections();

      if (collections.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No collections.' }] };
      }

      const text = collections.map((c) =>
        `- **${c.name}** (${c.paperCount} papers) — ID: ${c.id}`
      ).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  // 9. list_tags
  if (isEnabled('list_tags')) server.tool(
    'list_tags',
    'List all tags in the PaperShelf library',
    {},
    async () => {
      const tags = db.getTags();

      if (tags.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No tags.' }] };
      }

      const text = tags.map((t) =>
        `- **${t.name}** (${t.paperCount} papers) — ID: ${t.id}`
      ).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  // 10. list_categories
  if (isEnabled('list_categories')) server.tool(
    'list_categories',
    'List all arXiv categories (useful for filtering searches)',
    {},
    async () => {
      const grouped: Record<string, string[]> = {};
      for (const cat of ARXIV_CATEGORIES) {
        if (!grouped[cat.group]) grouped[cat.group] = [];
        grouped[cat.group].push(`${cat.id} — ${cat.name}`);
      }

      const text = Object.entries(grouped).map(([group, cats]) =>
        `### ${group}\n${cats.join('\n')}`
      ).join('\n\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
