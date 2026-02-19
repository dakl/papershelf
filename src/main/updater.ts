import { autoUpdater } from 'electron-updater'
import { ipcMain, app, BrowserWindow } from 'electron'
import log from 'electron-log'

export function setupUpdater() {
  // Configure logger
  autoUpdater.logger = log
  // autoUpdater.logger.transports.file.level = 'info'

  // Don't auto-download, let user decide
  autoUpdater.autoDownload = false

  // Set update feed URL (GitHub)
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'dakl',
    repo: 'papershelf',
    private: false
  })

  // IPC handlers for renderer communication
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (!result || !result.updateInfo) {
        return { available: false, error: 'No update information available' }
      }
      return {
        available: result.updateInfo.version !== app.getVersion(),
        version: result.updateInfo.version,
        releaseNotes: result.updateInfo.releaseNotes
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      log.error('Update check failed:', errorMessage)
      return { available: false, error: errorMessage }
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      log.error('Update download failed:', errorMessage)
      return { success: false, error: errorMessage }
    }
  })

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall()
  })

  // Event listeners
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    // Notify renderer process
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('updater:update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes
      })
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    // Notify renderer that update is ready to install
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('updater:update-downloaded', {
        version: info.version
      })
    })
  })

  autoUpdater.on('error', (error) => {
    log.error('Update error:', error)
    // Notify renderer of error
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('updater:error', {
        error: error.message || 'Unknown update error'
      })
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    // Send progress updates to renderer
    log.info(`Download progress: ${progress.percent}%`)
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('updater:progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      })
    })
  })
}