import net from 'net';
import { spawn } from 'child_process';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getMcpPort, isPackaged } from './http-server';

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function launchElectronApp(): void {
  if (isPackaged()) {
    spawn('open', ['-a', 'PaperShelf'], { detached: true, stdio: 'ignore' }).unref();
  } else {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    spawn('npx', ['electron', '.'], { cwd: projectRoot, detached: true, stdio: 'ignore' }).unref();
  }
}

async function waitForHttpServer(port: number, timeoutMs: number = 15000): Promise<void> {
  const start = Date.now();
  const interval = 500;
  while (Date.now() - start < timeoutMs) {
    if (await probePort(port)) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timed out waiting for PaperShelf HTTP server on port ${port}`);
}

export async function startBridge(): Promise<void> {
  const port = getMcpPort();
  const serverUrl = new URL(`http://127.0.0.1:${port}/mcp`);

  const isRunning = await probePort(port);
  if (!isRunning) {
    console.error(`PaperShelf not running, launching...`);
    launchElectronApp();
    await waitForHttpServer(port);
    console.error(`PaperShelf is up on port ${port}`);
  }

  const httpClient = new Client({ name: 'papershelf-bridge', version: '1.0.0' });
  const httpTransport = new StreamableHTTPClientTransport(serverUrl);
  await httpClient.connect(httpTransport);

  const stdioServer = new Server(
    { name: 'papershelf', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  stdioServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return await httpClient.listTools();
  });

  stdioServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await httpClient.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    });
  });

  const stdioTransport = new StdioServerTransport();

  stdioTransport.onclose = () => {
    httpTransport.close().catch(() => {});
    process.exit(0);
  };

  httpTransport.onclose = () => {
    console.error('PaperShelf HTTP server disconnected');
    process.exit(1);
  };

  await stdioServer.connect(stdioTransport);
}
