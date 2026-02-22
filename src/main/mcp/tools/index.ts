import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserWindow, Notification } from 'electron';
import type { ToolNotificationMode } from '../../../shared/types';
import { logToolCall } from '../../db/tool-stats';
import { setToolMode } from '../tool-config';
import { registerAnnotationTools } from './annotation-tools';
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
  { name: 'list_annotations', description: 'List annotations (highlights, sticky notes) for a paper' },
  { name: 'add_sticky_note', description: 'Add a sticky note annotation to a paper PDF' },
  { name: 'remove_annotation', description: 'Remove an annotation from a paper PDF' },
];

function humanToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const obj = args as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return '';

  const parts: string[] = [];
  for (const key of keys) {
    const value = obj[key];
    if (value === undefined || value === null) continue;
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    const truncated = str.length > 60 ? `${str.slice(0, 57)}...` : str;
    parts.push(truncated);
  }
  return parts.join(', ');
}

function formatNotificationBody(toolName: string, args: unknown): string {
  const label = humanToolName(toolName);
  const detail = humanizeArgs(args);
  return detail ? `${label} — ${detail}` : label;
}

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;
const pendingNotifications = new Set<Notification>();

function requestApprovalViaNotification(toolName: string, detail: string): Promise<'allow' | 'always' | 'deny'> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: 'allow' | 'always' | 'deny') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pendingNotifications.delete(notification);
      resolve(result);
    };

    const notification = new Notification({
      title: `Allow "${humanToolName(toolName)}"?`,
      body: detail,
      actions: [
        { type: 'button' as const, text: 'Allow Once' },
        { type: 'button' as const, text: 'Always Allow' },
      ],
      closeButtonText: 'Deny',
    });

    notification.on('action', (_event: Electron.Event, index: number) => {
      settle(index === 0 ? 'allow' : 'always');
    });

    notification.on('close', () => {
      settle('deny');
    });

    const timer = setTimeout(() => settle('deny'), APPROVAL_TIMEOUT_MS);

    pendingNotifications.add(notification);
    notification.show();
  });
}

function createInstrumentedServer(server: McpServer, toolModes: Record<string, ToolNotificationMode>): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === 'tool') {
        return (...toolArgs: unknown[]) => {
          const lastIndex = toolArgs.length - 1;
          const originalHandler = toolArgs[lastIndex] as (...handlerArgs: unknown[]) => Promise<unknown>;
          const toolName = toolArgs[0] as string;

          toolArgs[lastIndex] = async (...handlerArgs: unknown[]) => {
            const mode: ToolNotificationMode = toolModes[toolName] ?? 'notify';
            const argsString = JSON.stringify(handlerArgs[0] ?? {});
            const notificationBody = formatNotificationBody(toolName, handlerArgs[0]);

            if (mode === 'confirm') {
              const argsDetail = humanizeArgs(handlerArgs[0]);
              const detail = argsDetail
                ? `An MCP client wants to call this tool with:\n${argsDetail}`
                : 'An MCP client wants to call this tool.';

              const approval = await requestApprovalViaNotification(toolName, detail);

              if (approval === 'always') {
                setToolMode(toolName, 'notify');
                toolModes[toolName] = 'notify';
                for (const window of BrowserWindow.getAllWindows()) {
                  window.webContents.send('mcp:tools-changed');
                }
              } else if (approval === 'deny') {
                logToolCall(toolName, argsString, 0, 'denied');
                return {
                  content: [{ type: 'text' as const, text: 'Tool call denied by user' }],
                  isError: true,
                };
              }
            }

            const start = Date.now();
            try {
              const result = await originalHandler(...handlerArgs);
              logToolCall(toolName, argsString, Date.now() - start, 'success');

              if (mode !== 'silent') {
                new Notification({
                  title: 'PaperShelf',
                  body: notificationBody,
                }).show();
              }

              return result;
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              logToolCall(toolName, argsString, Date.now() - start, 'error', message);
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

export function registerTools(
  server: McpServer,
  disabledTools: Set<string> = new Set(),
  toolModes: Record<string, ToolNotificationMode> = {},
): void {
  const isEnabled = (name: string) => !disabledTools.has(name);
  const instrumented = createInstrumentedServer(server, toolModes);

  registerSearchTools(instrumented, isEnabled);
  registerPaperTools(instrumented, isEnabled);
  registerOrganizationTools(instrumented, isEnabled);
  registerAnnotationTools(instrumented, isEnabled);
}
