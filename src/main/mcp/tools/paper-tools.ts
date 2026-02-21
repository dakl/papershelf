import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchPaper } from '../../arxiv/fetch-paper';
import { fetchPaperHtml } from '../../arxiv/html';
import * as db from '../../database';
import { savePaperFromArxivPaper } from '../../services/save-paper';
import { formatPaper, generateBibtex, resolvePaperId } from './resolvers';

export function registerPaperTools(server: McpServer): void {
  server.registerTool(
    'get_paper',
    {
      description:
        'Get detailed information about a paper by library ID or arXiv ID. Fetches from arXiv if not in library.',
      inputSchema: {
        id: z.string().describe('Library paper ID (UUID) or arXiv ID (e.g. "2401.00001")'),
      },
    },
    async ({ id }) => {
      const paper = resolvePaperId(id);
      if (paper) {
        return { content: [{ type: 'text' as const, text: formatPaper(paper) }] };
      }

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

  server.registerTool(
    'save_paper',
    {
      description: 'Save an arXiv paper to the PaperShelf library (downloads PDF and extracts text)',
      inputSchema: {
        arxiv_id: z.string().describe('arXiv ID of the paper to save (e.g. "2401.00001")'),
      },
    },
    async ({ arxiv_id }) => {
      const arxivPaper = await fetchPaper(arxiv_id);
      if (!arxivPaper) {
        return { content: [{ type: 'text' as const, text: `Paper not found on arXiv: ${arxiv_id}` }] };
      }

      const result = await savePaperFromArxivPaper(arxivPaper);
      if (result.alreadyExisted) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Paper already in library: ${result.paper.title}\nLibrary ID: ${result.paper.id}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: `Saved: ${result.paper.title}\nLibrary ID: ${result.paper.id}${result.pdfDownloaded ? '\nPDF downloaded' : ''}${result.textExtracted ? ' and text extracted' : ''}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'fetch_paper_html',
    {
      description: 'Fetch the full HTML content of an arXiv paper as markdown (when available)',
      inputSchema: {
        arxiv_id: z.string().describe('arXiv ID of the paper (e.g. "2401.00001")'),
      },
    },
    async ({ arxiv_id }) => {
      try {
        const markdown = await fetchPaperHtml(arxiv_id);
        return { content: [{ type: 'text' as const, text: markdown }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to fetch HTML: ${msg}\n\nNote: Not all arXiv papers have HTML versions available.`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'get_bibtex',
    {
      description: 'Generate a BibTeX citation for a paper (by library ID or arXiv ID)',
      inputSchema: {
        id: z.string().describe('Library paper ID (UUID) or arXiv ID'),
      },
    },
    async ({ id }) => {
      let paper = resolvePaperId(id);

      if (!paper) {
        const arxivPaper = await fetchPaper(id);
        if (!arxivPaper) {
          return { content: [{ type: 'text' as const, text: `Paper not found: ${id}` }] };
        }
        paper = {
          id: '',
          arxivId: arxivPaper.id,
          doi: null,
          source: 'arxiv',
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

  server.registerTool(
    'toggle_favorite',
    {
      description: 'Toggle the favorite status of a paper.',
      inputSchema: {
        id: z.string().describe('Paper ID (UUID) or arXiv ID'),
      },
    },
    async ({ id }) => {
      const paper = resolvePaperId(id);
      if (!paper) {
        return { content: [{ type: 'text' as const, text: `Paper not found: ${id}` }] };
      }

      const isFavorite = db.toggleFavorite(paper.id);
      return {
        content: [
          { type: 'text' as const, text: `"${paper.title}" ${isFavorite ? 'added to' : 'removed from'} favorites.` },
        ],
      };
    },
  );
}
