const isMcpMode = process.argv.includes('--mcp-mode');

if (isMcpMode) {
  import('./mcp/bridge.js')
    .then(({ startBridge }) => startBridge())
    .catch((err: unknown) => {
      console.error('MCP bridge failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
} else {
  // Dynamic import so Electron is not required in --mcp-mode
  import('electron').then(({ app, BrowserWindow, Menu }) => {
    const path = require('path') as typeof import('path');

    let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

    function showAboutInRenderer(): void {
      mainWindow?.webContents.send('app:showAbout');
    }

    function buildAppMenu(): void {
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: app.getName(),
          submenu: [
            { label: `About ${app.getName()}`, click: showAboutInRenderer },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
          ],
        },
        {
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }]),
            { type: 'separator' as const },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' as const },
            { role: 'togglefullscreen' },
          ],
        },
        {
          label: 'Window',
          submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
        },
      ];
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }

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
      const { initDatabase } = await import('./database.js');
      initDatabase();
      const { registerIpcHandlers } = await import('./ipc-handlers.js');
      registerIpcHandlers();
      buildAppMenu();
      createWindow();
      const { isMcpServerEnabled } = await import('./mcp/tool-config.js');
      if (isMcpServerEnabled()) {
        const { startMcpHttpServer } = await import('./mcp/http-server.js');
        startMcpHttpServer().catch((err: unknown) => {
          console.warn('MCP HTTP server failed to start:', err instanceof Error ? err.message : err);
        });
      }

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
