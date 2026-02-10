import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDisabledTools } from './tool-config';
import { registerTools } from './tools';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'papershelf',
    version: '0.1.0',
  });

  const disabledTools = new Set(getDisabledTools());
  registerTools(server, disabledTools);

  return server;
}
