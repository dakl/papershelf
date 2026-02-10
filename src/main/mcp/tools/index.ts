import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logToolCall } from '../../db/tool-stats';
import { registerOrganizationTools } from './organization-tools';
import { registerPaperTools } from './paper-tools';
import { registerSearchTools } from './search-tools';

export { resolveCollectionId, resolvePaperId, resolveTagId } from './resolvers';

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

function createInstrumentedServer(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === 'tool') {
        return (...toolArgs: unknown[]) => {
          // server.tool has multiple overloads; the handler is always the last argument
          const lastIndex = toolArgs.length - 1;
          const originalHandler = toolArgs[lastIndex] as (...handlerArgs: unknown[]) => Promise<unknown>;
          const toolName = toolArgs[0] as string;

          toolArgs[lastIndex] = async (...handlerArgs: unknown[]) => {
            const start = Date.now();
            try {
              const result = await originalHandler(...handlerArgs);
              logToolCall(toolName, JSON.stringify(handlerArgs[0] ?? {}), Date.now() - start, 'success');
              return result;
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              logToolCall(toolName, JSON.stringify(handlerArgs[0] ?? {}), Date.now() - start, 'error', message);
              throw err;
            }
          };

          return (target.tool as (...args: unknown[]) => unknown)(...toolArgs);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function registerTools(server: McpServer, disabledTools: Set<string> = new Set()): void {
  const isEnabled = (name: string) => !disabledTools.has(name);
  const instrumented = createInstrumentedServer(server);

  registerSearchTools(instrumented, isEnabled);
  registerPaperTools(instrumented, isEnabled);
  registerOrganizationTools(instrumented, isEnabled);
}
