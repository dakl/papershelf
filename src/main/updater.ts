import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

// Strip HTML tags from release notes and clean up whitespace
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract plain text from electron-updater releaseNotes
function formatReleaseNotes(
  notes: string | Array<{ version: string; note: string }> | undefined | null,
): string | undefined {
  if (!notes) return undefined;
  if (typeof notes === 'string') return stripHtml(notes);
  if (Array.isArray(notes)) {
    return notes.map((n) => `${n.version}: ${stripHtml(n.note)}`).join('\n\n');
  }
  return undefined;
}

// Auto-update settings storage
let autoCheckEnabled = true;
let checkIntervalHours = 6;
let checkInterval: NodeJS.Timeout | null = null;
let lastCheckTime = 0;

// Start periodic update checks
export function setupUpdater() {
  // Configure logger
  autoUpdater.logger = log;

  // Don't auto-download, let user decide
  autoUpdater.autoDownload = false;

  // Set update feed URL (GitHub)
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'dakl',
    repo: 'papershelf',
    private: false,
  });

  // Start periodic checks if enabled
  if (autoCheckEnabled) {
    startPeriodicChecks();
  }

  // Register IPC handlers
  registerIpcHandlers();

  // Set up event listeners
  setupEventListeners();
}

// Start periodic update checks
function startPeriodicChecks() {
  // Clear any existing interval
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  // Initial check after delay
  setTimeout(
    () => {
      checkForUpdatesSilently();
    },
    30 * 60 * 1000,
  ); // 30 minutes after startup

  // Periodic checks
  checkInterval = setInterval(
    () => {
      checkForUpdatesSilently();
    },
    checkIntervalHours * 60 * 60 * 1000,
  );

  log.info(`Started periodic update checks every ${checkIntervalHours} hours`);
}

// Stop periodic update checks
function stopPeriodicChecks() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  log.info('Stopped periodic update checks');
}

// Check for updates silently (no user interaction)
async function checkForUpdatesSilently() {
  // Don't check too frequently
  const now = Date.now();
  if (now - lastCheckTime < 2 * 60 * 60 * 1000) {
    // 2 hour cooldown
    return;
  }

  lastCheckTime = now;
  log.info('Checking for updates in background...');

  try {
    const result = await autoUpdater.checkForUpdates();
    if (result?.updateInfo && result.updateInfo.version !== app.getVersion()) {
      log.info(`Update available: ${result.updateInfo.version}`);
      // Notify all windows about available update
      notifyUpdateAvailable(result.updateInfo.version);
    }
  } catch (error) {
    log.error('Background update check failed:', error instanceof Error ? error.message : error);
  }
}

// Notify all windows about available update
function notifyUpdateAvailable(version: string) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('updater:update-available', version);
  });
}

// Register IPC handlers
function registerIpcHandlers() {
  // Get auto-update settings
  ipcMain.handle('updater:getSettings', () => {
    return {
      autoCheckEnabled,
      checkIntervalHours,
      checkOnStartup: true,
    };
  });

  // Set auto-check enabled
  ipcMain.handle('updater:setAutoCheck', (_, enabled: boolean) => {
    autoCheckEnabled = enabled;
    if (enabled) {
      startPeriodicChecks();
    } else {
      stopPeriodicChecks();
    }
    return Promise.resolve();
  });

  // Set check interval
  ipcMain.handle('updater:setInterval', (_, hours: number) => {
    checkIntervalHours = hours;
    if (autoCheckEnabled) {
      // Restart with new interval
      startPeriodicChecks();
    }
    return Promise.resolve();
  });

  // Start periodic checks
  ipcMain.handle('updater:startPeriodicChecks', () => {
    startPeriodicChecks();
    return Promise.resolve();
  });

  // Stop periodic checks
  ipcMain.handle('updater:stopPeriodicChecks', () => {
    stopPeriodicChecks();
    return Promise.resolve();
  });

  // Manual update check
  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result || !result.updateInfo) {
        return { available: false, error: 'No update information available' };
      }
      return {
        available: result.updateInfo.version !== app.getVersion(),
        version: result.updateInfo.version,
        releaseNotes: formatReleaseNotes(result.updateInfo.releaseNotes),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Update check failed:', errorMessage);
      return { available: false, error: errorMessage };
    }
  });

  // Download update
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Update download failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });

  // Quit and install
  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall();
  });
}

// Set up event listeners
function setupEventListeners() {
  // Update available event
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    notifyUpdateAvailable(info.version);
  });

  // Update downloaded event
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('updater:update-downloaded', { version: info.version });
    });
  });

  // Error event
  autoUpdater.on('error', (error) => {
    log.error('Update error:', error);
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('updater:error', { error: error.message || 'Unknown update error' });
    });
  });

  // Download progress event
  autoUpdater.on('download-progress', (progress) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('updater:progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });
  });
}

// Check if app is idle (for smart checking)
export function isAppIdle(): boolean {
  // TODO: Implement actual idle detection
  // For now, always return true
  return true;
}
