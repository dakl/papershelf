import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { ToolNotificationMode } from '../../shared/types';
import { createServer } from './server';
import { getToolModes } from './tool-config';

const PROD_PORT = 3847;
const DEV_PORT = 13847;

function isPackaged(): boolean {
  return __dirname.includes('.app/') || __dirname.includes('.asar');
}

function getMcpPort(): number {
  return isPackaged() ? PROD_PORT : DEV_PORT;
}

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  toolHandles: Map<string, RegisteredTool>;
}

let httpServer: Server | null = null;
let activeSessions = new Map<string, SessionEntry>();
let currentPort = getMcpPort();
let sharedToolModes: Record<string, ToolNotificationMode> = {};

export async function startMcpHttpServer(port?: number): Promise<void> {
  if (httpServer) return;

  currentPort = port ?? getMcpPort();
  const sessions = new Map<string, SessionEntry>();
  activeSessions = sessions;
  sharedToolModes = getToolModes();

  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const host = req.headers.host;
    const allowedHosts = [`127.0.0.1:${currentPort}`, `localhost:${currentPort}`];
    if (host && !allowedHosts.includes(host)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (req.url !== '/mcp') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    if (req.method === 'POST') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
      };

      const { server: mcpServer, toolHandles } = createServer(sharedToolModes);
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);

      if (transport.sessionId) {
        sessions.set(transport.sessionId, { transport, toolHandles });
      }
    } else if (req.method === 'GET') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
      } else {
        res.writeHead(400);
        res.end('Missing or invalid session ID');
      }
    } else if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
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

  for (const session of activeSessions.values()) {
    try {
      await session.transport.close();
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

export function updateToolEnabled(toolName: string, enabled: boolean): void {
  for (const session of activeSessions.values()) {
    const handle = session.toolHandles.get(toolName);
    if (handle) {
      if (enabled) {
        handle.enable();
      } else {
        handle.disable();
      }
    }
  }
}

export function updateToolMode(toolName: string, mode: ToolNotificationMode): void {
  sharedToolModes[toolName] = mode;
}
