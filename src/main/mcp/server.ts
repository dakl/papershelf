import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolNotificationMode } from '../../shared/types';
import { getDisabledTools, getToolModes } from './tool-config';
import { registerTools } from './tools';

interface CreateServerResult {
  server: McpServer;
  toolHandles: Map<string, RegisteredTool>;
}

export function createServer(sharedToolModes?: Record<string, ToolNotificationMode>): CreateServerResult {
  const server = new McpServer({
    name: 'papershelf',
    version: '0.1.0',
  });

  const disabledTools = new Set(getDisabledTools());
  const toolModes = sharedToolModes ?? getToolModes();
  const toolHandles = registerTools(server, disabledTools, toolModes);

  return { server, toolHandles };
}
