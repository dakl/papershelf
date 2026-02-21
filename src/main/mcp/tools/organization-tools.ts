import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DEFAULT_COLOR } from '../../constants';
import * as db from '../../database';
import { resolveCollectionId, resolvePaperId, resolveTagId } from './resolvers';

export function registerOrganizationTools(server: McpServer): void {
  server.registerTool(
    'list_collections',
    {
      description: 'List all collections in the PaperShelf library',
    },
    async () => {
      const collections = db.getCollections();

      if (collections.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No collections.' }] };
      }

      const text = collections.map((c) => `- **${c.name}** (${c.paperCount} papers) — ID: ${c.id}`).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'list_tags',
    {
      description: 'List all tags in the PaperShelf library',
    },
    async () => {
      const tags = db.getTags();

      if (tags.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No tags.' }] };
      }

      const text = tags.map((t) => `- **${t.name}** (${t.paperCount} papers) — ID: ${t.id}`).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'create_collection',
    {
      description: 'Create a new collection for organizing papers',
      inputSchema: {
        name: z.string().describe('Collection name'),
        color: z.string().optional().default(DEFAULT_COLOR).describe('Color hex code (e.g. "#FF5733")'),
      },
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

  server.registerTool(
    'create_tag',
    {
      description: 'Create a new tag for labeling papers',
      inputSchema: {
        name: z.string().describe('Tag name'),
        color: z.string().optional().default(DEFAULT_COLOR).describe('Color hex code (e.g. "#FF5733")'),
      },
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

  server.registerTool(
    'add_paper_to_collection',
    {
      description: 'Add a paper to a collection. Both paper and collection can be referenced by ID or name.',
      inputSchema: {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        collection: z.string().describe('Collection ID or name'),
      },
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

  server.registerTool(
    'remove_paper_from_collection',
    {
      description: 'Remove a paper from a collection.',
      inputSchema: {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        collection: z.string().describe('Collection ID or name'),
      },
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

  server.registerTool(
    'add_tag_to_paper',
    {
      description: 'Add a tag to a paper. Both paper and tag can be referenced by ID or name.',
      inputSchema: {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        tag: z.string().describe('Tag ID or name'),
      },
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

  server.registerTool(
    'remove_tag_from_paper',
    {
      description: 'Remove a tag from a paper.',
      inputSchema: {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        tag: z.string().describe('Tag ID or name'),
      },
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
}
