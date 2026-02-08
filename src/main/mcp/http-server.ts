import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server';

const DEFAULT_PORT = 3847;

let httpServer: Server | null = null;
let activeSessions = new Map<string, StreamableHTTPServerTransport>();
let currentPort = DEFAULT_PORT;

export async function startMcpHttpServer(port?: number): Promise<void> {
  if (httpServer) return;

  currentPort = port ?? DEFAULT_PORT;
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  activeSessions = sessions;

  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== '/mcp') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    if (req.method === 'POST') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
      };

      const mcpServer = createServer();
      await mcpServer.connect(transport);

      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
      }

      await transport.handleRequest(req, res);
    } else if (req.method === 'GET') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(400);
        res.end('Missing or invalid session ID');
      }
    } else if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(400);
        res.end('Missing or invalid session ID');
      }
    } else {
      res.writeHead(405);
      res.end('Method not allowed');
    }
  });

  httpServer = server;

  return new Promise((resolve, reject) => {
    server.on('error', (err: Error) => {
      httpServer = null;
      reject(err);
    });
    server.listen(currentPort, '127.0.0.1', () => {
      console.log(`MCP HTTP server listening on http://127.0.0.1:${currentPort}/mcp`);
      resolve();
    });
  });
}

export async function stopMcpHttpServer(): Promise<void> {
  if (!httpServer) return;

  for (const transport of activeSessions.values()) {
    try {
      await transport.close();
    } catch {
      // ignore close errors
    }
  }
  activeSessions.clear();

  return new Promise((resolve) => {
    httpServer!.close(() => {
      httpServer = null;
      console.log('MCP HTTP server stopped');
      resolve();
    });
  });
}

export function getMcpHttpServerStatus(): { running: boolean; port: number } {
  return { running: httpServer !== null, port: currentPort };
}
