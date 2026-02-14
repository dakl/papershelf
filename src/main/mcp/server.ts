import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDisabledTools, getToolModes } from './tool-config';
import { registerTools } from './tools';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'papershelf',
    version: '0.1.0',
  });

  const disabledTools = new Set(getDisabledTools());
  const toolModes = getToolModes();
  registerTools(server, disabledTools, toolModes);

  return server;
}
