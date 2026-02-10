import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DEFAULT_COLOR } from '../../constants';
import * as db from '../../database';
import { resolveCollectionId, resolvePaperId, resolveTagId } from './resolvers';

export function registerOrganizationTools(server: McpServer, isEnabled: (name: string) => boolean): void {
  if (isEnabled('list_collections'))
    server.tool('list_collections', 'List all collections in the PaperShelf library', {}, async () => {
      const collections = db.getCollections();

      if (collections.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No collections.' }] };
      }

      const text = collections.map((c) => `- **${c.name}** (${c.paperCount} papers) — ID: ${c.id}`).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    });

  if (isEnabled('list_tags'))
    server.tool('list_tags', 'List all tags in the PaperShelf library', {}, async () => {
      const tags = db.getTags();

      if (tags.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No tags.' }] };
      }

      const text = tags.map((t) => `- **${t.name}** (${t.paperCount} papers) — ID: ${t.id}`).join('\n');

      return { content: [{ type: 'text' as const, text }] };
    });

  if (isEnabled('create_collection'))
    server.tool(
      'create_collection',
      'Create a new collection for organizing papers',
      {
        name: z.string().describe('Collection name'),
        color: z.string().optional().default(DEFAULT_COLOR).describe('Color hex code (e.g. "#FF5733")'),
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

  if (isEnabled('create_tag'))
    server.tool(
      'create_tag',
      'Create a new tag for labeling papers',
      {
        name: z.string().describe('Tag name'),
        color: z.string().optional().default(DEFAULT_COLOR).describe('Color hex code (e.g. "#FF5733")'),
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
}
