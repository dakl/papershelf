import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'papershelf',
    version: '0.1.0',
  });

  registerTools(server);

  return server;
}

export async function startMcpStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
