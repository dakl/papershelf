import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Collection, LibraryPaper, Tag } from '../../shared/types';
import { ARXIV_CATEGORIES } from '../arxiv/categories';
import { fetchPaper } from '../arxiv/fetch-paper';
import { fetchPaperHtml } from '../arxiv/html';
import { searchArxiv } from '../arxiv-client';
import * as db from '../database';
import { downloadAndExtractPdf } from '../pdf-processor';

// --- Resolver helpers ---

export function resolvePaperId(idOrArxivId: string): LibraryPaper | null {
  return db.getPaperById(idOrArxivId) ?? db.getPaperByArxivId(idOrArxivId);
}

export function resolveCollectionId(idOrName: string): Collection | null {
  const collections = db.getCollections();
  const byId = collections.find((c) => c.id === idOrName);
  if (byId) return byId;
  return db.getCollectionByName(idOrName);
}

export function resolveTagId(idOrName: string): Tag | null {
  const tags = db.getTags();
  const byId = tags.find((t) => t.id === idOrName);
  if (byId) return byId;
  return db.getTagByName(idOrName);
}

// --- Formatters ---

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
  ]
    .filter(Boolean)
    .join('\n');
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
  { name: 'search_arxiv', description: 'Search arXiv for papers by keyword, author, title, or topic' },
  { name: 'search_library', description: 'Full-text search across saved papers with optional filters' },
  { name: 'get_paper', description: 'Get detailed info about a paper by ID' },
  { name: 'list_papers', description: 'List papers in the library with optional collection/tag filters' },
  { name: 'save_paper', description: 'Save an arXiv paper to the library' },
  { name: 'fetch_paper_html', description: 'Fetch full HTML content of an arXiv paper' },
  { name: 'get_bibtex', description: 'Generate a BibTeX citation for a paper' },
  { name: 'list_collections', description: 'List all collections' },
  { name: 'list_tags', description: 'List all tags' },
  { name: 'list_categories', description: 'List all arXiv categories' },
  { name: 'create_collection', description: 'Create a new collection' },
  { name: 'create_tag', description: 'Create a new tag' },
  { name: 'add_paper_to_collection', description: 'Add a paper to a collection' },
  { name: 'remove_paper_from_collection', description: 'Remove a paper from a collection' },
  { name: 'add_tag_to_paper', description: 'Add a tag to a paper' },
  { name: 'remove_tag_from_paper', description: 'Remove a tag from a paper' },
  { name: 'toggle_favorite', description: 'Toggle favorite status on a paper' },
];

export function registerTools(server: McpServer, disabledTools: Set<string> = new Set()): void {
  const isEnabled = (name: string) => !disabledTools.has(name);

  // 1. search_arxiv
  if (isEnabled('search_arxiv'))
    server.tool(
      'search_arxiv',
      'Search arXiv for papers. Supports field-specific search: use "query" for general keywords, "author" for author names, and "title" for title keywords. At least one of query/author/title is required. Fields can be combined (e.g. author + title) for more precise results.',
      {
        query: z
          .string()
          .optional()
          .describe(
            'General search keywords (searches all fields). At least one of query, author, or title is required.',
          ),
        author: z.string().optional().describe('Author name to search for (e.g. "Vaswani")'),
        title: z.string().optional().describe('Title keywords to search for (e.g. "attention")'),
        max_results: z.number().min(1).max(50).default(10).describe('Maximum number of results'),
        sort_by: z.enum(['relevance', 'lastUpdatedDate', 'submittedDate']).default('relevance').describe('Sort order'),
        categories: z.array(z.string()).optional().describe('Filter by arXiv categories (e.g. ["cs.AI", "cs.CL"])'),
      },
      async ({ query, author, title, max_results, sort_by, categories }) => {
        if (!query && !author && !title) {
          return { content: [{ type: 'text' as const, text: 'At least one of query, author, or title is required.' }] };
        }

        const papers = await searchArxiv({
          query,
          author,
          title,
          maxResults: max_results,
          sortBy: sort_by,
          categories,
        });

        if (papers.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No papers found.' }] };
        }

        const text = papers
          .map((p, i) =>
            [
              `### ${i + 1}. ${p.title}`,
              `Authors: ${p.authors.join(', ')}`,
              `arXiv ID: ${p.id} | Published: ${p.publishedDate}`,
              `Categories: ${p.categories.join(', ')}`,
              `URL: ${p.arxivUrl}`,
              '',
              p.abstract,
            ].join('\n'),
          )
          .join('\n\n---\n\n');

        return { content: [{ type: 'text' as const, text }] };
      },
    );

  // 2. search_library
  if (isEnabled('search_library'))
    server.tool(
      'search_library',
      'Full-text search across papers saved in the PaperShelf library. Searches titles, abstracts, authors, and extracted PDF text. Optionally filter results by collection, tag, or favorites.',
      {
        query: z
          .string()
          .describe('Search query for full-text search across titles, abstracts, authors, and paper content'),
        collection: z.string().optional().describe('Filter by collection (ID or name)'),
        tag: z.string().optional().describe('Filter by tag (ID or name)'),
        favorites_only: z.boolean().optional().default(false).describe('Only return favorited papers'),
      },
      async ({ query, collection, tag, favorites_only }) => {
        let papers = db.searchLibrary(query);

        if (collection) {
          const resolved = resolveCollectionId(collection);
          if (!resolved) {
            return { content: [{ type: 'text' as const, text: `Collection not found: ${collection}` }] };
          }
          const collectionId = resolved.id;
          papers = papers.filter((p) => p.collections.some((c) => c.id === collectionId));
        }

        if (tag) {
          const resolved = resolveTagId(tag);
          if (!resolved) {
            return { content: [{ type: 'text' as const, text: `Tag not found: ${tag}` }] };
          }
          const tagId = resolved.id;
          papers = papers.filter((p) => p.tags.some((t) => t.id === tagId));
        }

        if (favorites_only) {
          papers = papers.filter((p) => p.isFavorite);
        }

        if (papers.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No matching papers in library.' }] };
        }

        const text = papers.map((p, i) => `### ${i + 1}. ${formatPaper(p)}`).join('\n\n---\n\n');
        return { content: [{ type: 'text' as const, text }] };
      },
    );

  // 3. get_paper
  if (isEnabled('get_paper'))
    server.tool(
      'get_paper',
      'Get detailed information about a paper by library ID or arXiv ID. Fetches from arXiv if not in library.',
      {
        id: z.string().describe('Library paper ID (UUID) or arXiv ID (e.g. "2401.00001")'),
      },
      async ({ id }) => {
        const paper = resolvePaperId(id);
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
  if (isEnabled('list_papers'))
    server.tool(
      'list_papers',
      'List papers in the PaperShelf library. Filter by view (all, favorites, recent), or by a specific collection or tag.',
      {
        view: z
          .enum(['all-papers', 'favorites', 'recent', 'collection', 'tag'])
          .default('all-papers')
          .describe('Filter view'),
        collection_id: z.string().optional().describe('Collection ID or name (required when view is "collection")'),
        tag_id: z.string().optional().describe('Tag ID or name (required when view is "tag")'),
      },
      async ({ view, collection_id, tag_id }) => {
        let resolvedCollectionId: string | undefined;
        let resolvedTagId: string | undefined;

        if (view === 'collection') {
          if (!collection_id) {
            return {
              content: [{ type: 'text' as const, text: 'collection_id is required when view is "collection".' }],
            };
          }
          const resolved = resolveCollectionId(collection_id);
          if (!resolved) {
            return { content: [{ type: 'text' as const, text: `Collection not found: ${collection_id}` }] };
          }
          resolvedCollectionId = resolved.id;
        }

        if (view === 'tag') {
          if (!tag_id) {
            return { content: [{ type: 'text' as const, text: 'tag_id is required when view is "tag".' }] };
          }
          const resolved = resolveTagId(tag_id);
          if (!resolved) {
            return { content: [{ type: 'text' as const, text: `Tag not found: ${tag_id}` }] };
          }
          resolvedTagId = resolved.id;
        }

        const papers = db.getPapers({
          view,
          collectionId: resolvedCollectionId,
          tagId: resolvedTagId,
        });

        if (papers.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No papers in library.' }] };
        }

        const text = papers
          .map(
            (p, i) =>
              `${i + 1}. **${p.title}** — ${p.authors.slice(0, 3).join(', ')}${p.authors.length > 3 ? ' et al.' : ''} (${p.arxivId})${p.isFavorite ? ' ⭐' : ''}`,
          )
          .join('\n');

        return { content: [{ type: 'text' as const, text: `${papers.length} papers:\n\n${text}` }] };
      },
    );

  // 5. save_paper
  if (isEnabled('save_paper'))
    server.tool(
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

        return {
          content: [
            {
              type: 'text' as const,
              text: `Saved: ${saved.title}\nLibrary ID: ${saved.id}${pdfPath ? '\nPDF downloaded' : ''}${fullText ? ' and text extracted' : ''}`,
            },
          ],
        };
      },
    );

  // 6. fetch_paper_html
  if (isEnabled('fetch_paper_html'))
    server.tool(
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

  // 7. get_bibtex
  if (isEnabled('get_bibtex'))
    server.tool(
      'get_bibtex',
      'Generate a BibTeX citation for a paper (by library ID or arXiv ID)',
      {
        id: z.string().describe('Library paper ID (UUID) or arXiv ID'),
      },
      async ({ id }) => {
        let paper = resolvePaperId(id);

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
  if (isEnabled('list_collections'))
    server.tool('list_collections', 'List all collections in the PaperShelf library', {}, async () => {
      const collections = db.getCollections();

      if (collections.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No collections.' }] };
      }

      const text = collections.map((c) => `- **${c.name}** (${c.paperCount} papers) — ID: ${c.id}`).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    });

  // 9. list_tags
  if (isEnabled('list_tags'))
    server.tool('list_tags', 'List all tags in the PaperShelf library', {}, async () => {
      const tags = db.getTags();

      if (tags.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No tags.' }] };
      }

      const text = tags.map((t) => `- **${t.name}** (${t.paperCount} papers) — ID: ${t.id}`).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    });

  // 10. list_categories
  if (isEnabled('list_categories'))
    server.tool('list_categories', 'List all arXiv categories (useful for filtering searches)', {}, async () => {
      const grouped: Record<string, string[]> = {};
      for (const cat of ARXIV_CATEGORIES) {
        if (!grouped[cat.group]) grouped[cat.group] = [];
        grouped[cat.group].push(`${cat.id} — ${cat.name}`);
      }

      const text = Object.entries(grouped)
        .map(([group, cats]) => `### ${group}\n${cats.join('\n')}`)
        .join('\n\n');

      return { content: [{ type: 'text' as const, text }] };
    });

  // 11. create_collection
  if (isEnabled('create_collection'))
    server.tool(
      'create_collection',
      'Create a new collection for organizing papers',
      {
        name: z.string().describe('Collection name'),
        color: z.string().optional().default('#007AFF').describe('Color hex code (e.g. "#FF5733")'),
      },
      async ({ name, color }) => {
        const existing = db.getCollectionByName(name);
        if (existing) {
          return {
            content: [{ type: 'text' as const, text: `Collection "${name}" already exists (ID: ${existing.id}).` }],
          };
        }

        const collection = db.createCollection(name, color);
        return {
          content: [{ type: 'text' as const, text: `Created collection "${collection.name}" (ID: ${collection.id})` }],
        };
      },
    );

  // 12. create_tag
  if (isEnabled('create_tag'))
    server.tool(
      'create_tag',
      'Create a new tag for labeling papers',
      {
        name: z.string().describe('Tag name'),
        color: z.string().optional().default('#007AFF').describe('Color hex code (e.g. "#FF5733")'),
      },
      async ({ name, color }) => {
        const existing = db.getTagByName(name);
        if (existing) {
          return { content: [{ type: 'text' as const, text: `Tag "${name}" already exists (ID: ${existing.id}).` }] };
        }

        const tag = db.createTag(name, color);
        return { content: [{ type: 'text' as const, text: `Created tag "${tag.name}" (ID: ${tag.id})` }] };
      },
    );

  // 13. add_paper_to_collection
  if (isEnabled('add_paper_to_collection'))
    server.tool(
      'add_paper_to_collection',
      'Add a paper to a collection. Both paper and collection can be referenced by ID or name.',
      {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        collection: z.string().describe('Collection ID or name'),
      },
      async ({ paper_id, collection }) => {
        const paper = resolvePaperId(paper_id);
        if (!paper) {
          return { content: [{ type: 'text' as const, text: `Paper not found: ${paper_id}` }] };
        }

        const resolved = resolveCollectionId(collection);
        if (!resolved) {
          return { content: [{ type: 'text' as const, text: `Collection not found: ${collection}` }] };
        }

        db.addPaperToCollection(paper.id, resolved.id);
        return {
          content: [{ type: 'text' as const, text: `Added "${paper.title}" to collection "${resolved.name}".` }],
        };
      },
    );

  // 14. remove_paper_from_collection
  if (isEnabled('remove_paper_from_collection'))
    server.tool(
      'remove_paper_from_collection',
      'Remove a paper from a collection.',
      {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        collection: z.string().describe('Collection ID or name'),
      },
      async ({ paper_id, collection }) => {
        const paper = resolvePaperId(paper_id);
        if (!paper) {
          return { content: [{ type: 'text' as const, text: `Paper not found: ${paper_id}` }] };
        }

        const resolved = resolveCollectionId(collection);
        if (!resolved) {
          return { content: [{ type: 'text' as const, text: `Collection not found: ${collection}` }] };
        }

        db.removePaperFromCollection(paper.id, resolved.id);
        return {
          content: [{ type: 'text' as const, text: `Removed "${paper.title}" from collection "${resolved.name}".` }],
        };
      },
    );

  // 15. add_tag_to_paper
  if (isEnabled('add_tag_to_paper'))
    server.tool(
      'add_tag_to_paper',
      'Add a tag to a paper. Both paper and tag can be referenced by ID or name.',
      {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        tag: z.string().describe('Tag ID or name'),
      },
      async ({ paper_id, tag }) => {
        const paper = resolvePaperId(paper_id);
        if (!paper) {
          return { content: [{ type: 'text' as const, text: `Paper not found: ${paper_id}` }] };
        }

        const resolved = resolveTagId(tag);
        if (!resolved) {
          return { content: [{ type: 'text' as const, text: `Tag not found: ${tag}` }] };
        }

        db.addTagToPaper(paper.id, resolved.id);
        return { content: [{ type: 'text' as const, text: `Added tag "${resolved.name}" to "${paper.title}".` }] };
      },
    );

  // 16. remove_tag_from_paper
  if (isEnabled('remove_tag_from_paper'))
    server.tool(
      'remove_tag_from_paper',
      'Remove a tag from a paper.',
      {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        tag: z.string().describe('Tag ID or name'),
      },
      async ({ paper_id, tag }) => {
        const paper = resolvePaperId(paper_id);
        if (!paper) {
          return { content: [{ type: 'text' as const, text: `Paper not found: ${paper_id}` }] };
        }

        const resolved = resolveTagId(tag);
        if (!resolved) {
          return { content: [{ type: 'text' as const, text: `Tag not found: ${tag}` }] };
        }

        db.removeTagFromPaper(paper.id, resolved.id);
        return { content: [{ type: 'text' as const, text: `Removed tag "${resolved.name}" from "${paper.title}".` }] };
      },
    );

  // 17. toggle_favorite
  if (isEnabled('toggle_favorite'))
    server.tool(
      'toggle_favorite',
      'Toggle the favorite status of a paper.',
      {
        id: z.string().describe('Paper ID (UUID) or arXiv ID'),
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
