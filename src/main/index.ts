import { initDatabase } from './database.js';

const isMcpMode = process.argv.includes('--mcp-mode');

if (isMcpMode) {
  initDatabase();
  import('./mcp/server.js').then(({ startMcpStdioServer }) => startMcpStdioServer());
} else {
  // Dynamic import so Electron is not required in --mcp-mode
  import('electron').then(({ app, BrowserWindow }) => {
    const path = require('path') as typeof import('path');

    let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

    function createWindow(): void {
      mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 16 },
        vibrancy: 'sidebar',
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      if (!app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      } else {
        mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
      }

      mainWindow.on('closed', () => {
        mainWindow = null;
      });
    }

    app.whenReady().then(async () => {
      initDatabase();
      const { registerIpcHandlers } = await import('./ipc-handlers.js');
      registerIpcHandlers();
      createWindow();
      const { startMcpHttpServer } = await import('./mcp/http-server.js');
      startMcpHttpServer().catch((err: unknown) => {
        console.warn('MCP HTTP server failed to start:', err instanceof Error ? err.message : err);
      });

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  });
}
