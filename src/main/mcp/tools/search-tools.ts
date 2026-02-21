import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ARXIV_CATEGORIES } from '../../arxiv/categories';
import { searchArxiv } from '../../arxiv-client';
import * as db from '../../database';
import { formatPaper, resolveCollectionId, resolveTagId } from './resolvers';

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    'search_arxiv',
    {
      description:
        'Search arXiv for papers. Supports field-specific search: use "query" for general keywords, "author" for author names, and "title" for title keywords. At least one of query/author/title is required. Fields can be combined (e.g. author + title) for more precise results.',
      inputSchema: {
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

  server.registerTool(
    'search_library',
    {
      description:
        'Full-text search across papers saved in the PaperShelf library. Searches titles, abstracts, authors, and extracted PDF text. Optionally filter results by collection, tag, or favorites.',
      inputSchema: {
        query: z
          .string()
          .describe('Search query for full-text search across titles, abstracts, authors, and paper content'),
        collection: z.string().optional().describe('Filter by collection (ID or name)'),
        tag: z.string().optional().describe('Filter by tag (ID or name)'),
        favorites_only: z.boolean().optional().default(false).describe('Only return favorited papers'),
      },
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

  server.registerTool(
    'list_papers',
    {
      description:
        'List papers in the PaperShelf library. Filter by view (all, favorites, recent), or by a specific collection or tag.',
      inputSchema: {
        view: z
          .enum(['all-papers', 'favorites', 'recent', 'collection', 'tag'])
          .default('all-papers')
          .describe('Filter view'),
        collection_id: z.string().optional().describe('Collection ID or name (required when view is "collection")'),
        tag_id: z.string().optional().describe('Tag ID or name (required when view is "tag")'),
      },
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
        .map((p, i) => {
          const identifier = p.arxivId ?? (p.doi ? `DOI: ${p.doi}` : 'local');
          return `${i + 1}. **${p.title}** — ${p.authors.slice(0, 3).join(', ')}${p.authors.length > 3 ? ' et al.' : ''} (${identifier})${p.isFavorite ? ' ⭐' : ''}`;
        })
        .join('\n');

      return { content: [{ type: 'text' as const, text: `${papers.length} papers:\n\n${text}` }] };
    },
  );

  server.registerTool(
    'list_categories',
    {
      description: 'List all arXiv categories (useful for filtering searches)',
    },
    async () => {
      const grouped: Record<string, string[]> = {};
      for (const cat of ARXIV_CATEGORIES) {
        if (!grouped[cat.group]) grouped[cat.group] = [];
        grouped[cat.group].push(`${cat.id} — ${cat.name}`);
      }

      const text = Object.entries(grouped)
        .map(([group, cats]) => `### ${group}\n${cats.join('\n')}`)
        .join('\n\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
