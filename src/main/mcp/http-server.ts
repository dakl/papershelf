import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { createServer } from './server';

const PROD_PORT = 3847;
const DEV_PORT = 13847;

export function isPackaged(): boolean {
  return __dirname.includes('.app/') || __dirname.includes('.asar');
}

export function getMcpPort(): number {
  return isPackaged() ? PROD_PORT : DEV_PORT;
}

let httpServer: Server | null = null;
let activeSessions = new Map<string, StreamableHTTPServerTransport>();
let currentPort = DEV_PORT;

export async function startMcpHttpServer(port?: number): Promise<void> {
  if (httpServer) return;

  currentPort = port ?? getMcpPort();
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
      await transport.handleRequest(req, res);

      // sessionId is generated during handleRequest when processing the initialize request
      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
      }
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

export async function restartMcpHttpServerIfRunning(): Promise<void> {
  const status = getMcpHttpServerStatus();
  if (status.running) {
    await stopMcpHttpServer();
    await startMcpHttpServer(status.port);
  }
}
