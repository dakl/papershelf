import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools';
import { getDisabledTools } from './tool-config';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'papershelf',
    version: '0.1.0',
  });

  const disabledTools = new Set(getDisabledTools());
  registerTools(server, disabledTools);

  return server;
}
