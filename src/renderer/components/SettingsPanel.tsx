import { useCallback, useEffect, useState } from 'react';
import type { ToolNotificationMode } from '../../shared/types';
import { useSettingsStore } from '../stores/settingsStore';
import { buildKeyString, formatKeys, getDefaultKeys, useShortcutStore } from '../stores/shortcutStore';
import { AboutDialog } from './AboutDialog';

type ToolState = 'off' | ToolNotificationMode;

const TOOL_STATE_OPTIONS: { value: ToolState; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'silent', label: 'Silent' },
  { value: 'notify', label: 'Notify' },
  { value: 'confirm', label: 'Confirm' },
];

function ToolModeControl({ state, onChange }: { state: ToolState; onChange: (state: ToolState) => void }) {
  return (
    <div className="inline-grid grid-cols-4 rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden">
      {TOOL_STATE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-0.5 text-mac-small text-center transition-colors ${
            state === opt.value
              ? opt.value === 'off'
                ? 'bg-gray-400 dark:bg-gray-500 text-white'
                : 'bg-mac-accent text-white'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleSwitch({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-hidden shrink-0 ${
        enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function KeyboardShortcutsSection() {
  const { shortcuts, setShortcutKeys, resetShortcut, resetAll } = useShortcutStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!recordingId) return;
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setRecordingId(null);
        setConflict(null);
        return;
      }

      const keyString = buildKeyString(event);
      if (!keyString) return;

      const result = setShortcutKeys(recordingId, keyString);
      if (result.success) {
        setRecordingId(null);
        setConflict(null);
      } else {
        setConflict(result.conflict ?? null);
      }
    },
    [recordingId, setShortcutKeys],
  );

  useEffect(() => {
    if (!recordingId) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingId, handleKeyDown]);

  const hasAnyOverride = shortcuts.some((s) => s.keys !== getDefaultKeys(s.id));

  return (
    <section className="mb-8">
      <h2 className="text-mac-body font-semibold mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
        Keyboard Shortcuts
      </h2>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-white/5 py-0.5">
        {shortcuts.map((shortcut) => {
          const isRecording = recordingId === shortcut.id;
          const isOverridden = shortcut.keys !== getDefaultKeys(shortcut.id);
          return (
            <div
              key={shortcut.id}
              className="flex items-center justify-between px-3 py-1 mx-0.5 rounded-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className="text-mac-small">{shortcut.label}</span>
              <div className="flex items-center gap-1.5">
                {isRecording && conflict && <span className="text-mac-small text-red-500">Used by {conflict}</span>}
                <button
                  onClick={() => {
                    setConflict(null);
                    setRecordingId(isRecording ? null : shortcut.id);
                  }}
                  className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
                    isRecording
                      ? 'bg-mac-accent text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {isRecording ? 'Press keys...' : formatKeys(shortcut.keys)}
                </button>
                {isOverridden && !isRecording && (
                  <button
                    onClick={() => resetShortcut(shortcut.id)}
                    className="text-mac-small text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Reset to default"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasAnyOverride && (
        <button
          onClick={resetAll}
          className="mt-2 text-mac-small text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Reset all to defaults
        </button>
      )}
    </section>
  );
}

function PdfLibrarySection() {
  const [libraryPath, setLibraryPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getPdfLibraryPath().then(setLibraryPath);
  }, []);

  const handleChooseFolder = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const result = await window.electronAPI.setPdfLibraryPath();
      if (!result.cancelled && result.path) {
        setLibraryPath(result.path);
        if (result.movedCount && result.movedCount > 0) {
          setStatusMessage(`Moved ${result.movedCount} PDF${result.movedCount === 1 ? '' : 's'} to new location`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      await window.electronAPI.resetPdfLibraryPath();
      setLibraryPath(null);
      setStatusMessage('Reset to default location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="text-mac-body font-semibold mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
        PDF Library
      </h2>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-white/5 p-4 space-y-3">
        <div>
          <div className="text-mac-body font-medium">Storage Location</div>
          <div className="text-mac-small text-gray-500 dark:text-gray-400">
            Where downloaded and imported PDFs are stored
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-mac-small text-gray-600 dark:text-gray-300 truncate">
            {libraryPath || 'Default (app data)'}
          </div>
          <button
            onClick={handleChooseFolder}
            disabled={loading}
            className="px-3 py-1 rounded text-mac-small bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Moving...' : 'Choose Folder...'}
          </button>
          {libraryPath && (
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-3 py-1 rounded text-mac-small text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
          )}
        </div>
        {statusMessage && <div className="text-mac-small text-green-600 dark:text-green-400">{statusMessage}</div>}
      </div>
    </section>
  );
}

function UpdatesSection() {
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('')
  const [latestVersion, setLatestVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get current version
    window.electronAPI.getAppVersion().then(setCurrentVersion)
    
    // Set up event listeners for updater events
    const handleProgress = (_event: any, data: { percent: number }) => {
      setProgress(data.percent)
    }
    
    const handleError = (_event: any, data: { error: string }) => {
      setError(data.error)
      setDownloading(false)
      setChecking(false)
    }
    
    const handleUpdateDownloaded = (_event: any, data: { version: string }) => {
      setUpdateAvailable(false)
      setDownloading(false)
      // Show success message or auto-install
    }
    
    window.electronAPI.onUpdaterProgress(handleProgress)
    window.electronAPI.onUpdaterError(handleError)
    window.electronAPI.onUpdaterUpdateDownloaded(handleUpdateDownloaded)
    
    return () => {
      // Clean up event listeners
    }
  }, [])

  const checkForUpdates = async () => {
    setChecking(true)
    setError(null)
    try {
      const result = await window.electronAPI.checkForUpdates()
      if (result.available) {
        setUpdateAvailable(true)
        setLatestVersion(result.version)
        setReleaseNotes(result.releaseNotes || 'No release notes available')
      } else {
        setUpdateAvailable(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates')
    } finally {
      setChecking(false)
    }
  }

  const downloadUpdate = async () => {
    setDownloading(true)
    setError(null)
    setProgress(0)
    
    try {
      const result = await window.electronAPI.downloadUpdate()
      if (result.success) {
        // Update will be installed on next launch
        setUpdateAvailable(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download update')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-mac-body font-semibold mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
        Updates
      </h2>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-white/5 p-4 space-y-4">
        <div>
          <div className="text-mac-body font-medium">Current Version</div>
          <div className="text-mac-small text-gray-500 dark:text-gray-400">
            {currentVersion || 'Loading...'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={checkForUpdates}
            disabled={checking || downloading}
            className="px-4 py-2 rounded text-mac-small bg-mac-accent text-white hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:bg-opacity-70"
          >
            {checking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {error && (
          <div className="text-mac-small text-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        {updateAvailable && (
          <div className="rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-mac-body font-medium text-green-700 dark:text-green-300">
                  Update Available
                </div>
                <div className="text-mac-small text-gray-600 dark:text-gray-300">
                  Version {latestVersion} is available
                </div>
                {releaseNotes && (
                  <details className="mt-2">
                    <summary className="text-mac-small text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                      Release Notes
                    </summary>
                    <div className="mt-1 text-mac-small text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {releaseNotes}
                    </div>
                  </details>
                )}
              </div>
              <button
                onClick={downloadUpdate}
                disabled={downloading}
                className={`px-3 py-1 rounded text-mac-small transition-colors ${
                  downloading
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-mac-accent text-white hover:bg-opacity-90'
                }`}
              >
                {downloading ? `${progress}% Downloading...` : 'Download & Install'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function SettingsPanel() {
  const [showAbout, setShowAbout] = useState(false);
  const {
    mcpStatus,
    mcpLoading,
    mcpTools,
    toolStats,
    loadMcpStatus,
    startMcpServer,
    stopMcpServer,
    loadMcpTools,
    setToolEnabled,
    setToolMode,
    setAllToolModes,
    loadToolStats,
  } = useSettingsStore();
  const [portInput, setPortInput] = useState('3847');

  const handleToolStateChange = async (toolName: string, state: ToolState) => {
    if (state === 'off') {
      await setToolEnabled(toolName, false);
    } else {
      const tool = mcpTools.find((t) => t.name === toolName);
      if (tool && !tool.enabled) await setToolEnabled(toolName, true);
      await setToolMode(toolName, state);
    }
  };

  const handleSetAllState = async (state: ToolState) => {
    if (state === 'off') {
      await Promise.all(mcpTools.filter((t) => t.enabled).map((t) => setToolEnabled(t.name, false)));
    } else {
      await Promise.all(mcpTools.filter((t) => !t.enabled).map((t) => setToolEnabled(t.name, true)));
      await setAllToolModes(state);
    }
  };

  useEffect(() => {
    loadMcpStatus();
    loadMcpTools();
    loadToolStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMcpStatus, loadMcpTools, loadToolStats]);

  useEffect(() => {
    setPortInput(String(mcpStatus.port));
  }, [mcpStatus.port]);

  const handleServerToggle = async () => {
    if (mcpStatus.running) {
      await stopMcpServer();
    } else {
      const port = parseInt(portInput, 10);
      if (port > 0 && port <= 65535) {
        await startMcpServer(port);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-4">
        <h1 className="text-lg font-semibold mb-6">Settings</h1>

        {/* Keyboard Shortcuts Section */}
        <KeyboardShortcutsSection />

        {/* PDF Library Section */}
        <PdfLibrarySection />

        {/* Updates Section */}
        <UpdatesSection />

        {/* MCP Server Section */}
        <section className="mb-8">
          <h2 className="text-mac-body font-semibold mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
            MCP Server
          </h2>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-white/5 p-4 space-y-4">
            {/* Toggle row */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-mac-body font-medium">HTTP Server</div>
                <div className="text-mac-small text-gray-500 dark:text-gray-400">
                  Exposes PaperShelf tools via MCP protocol
                </div>
              </div>
              <ToggleSwitch enabled={mcpStatus.running} onChange={handleServerToggle} disabled={mcpLoading} />
            </div>

            {/* Port input */}
            <div className="flex items-center gap-3">
              <label className="text-mac-body text-gray-600 dark:text-gray-300 w-12">Port</label>
              <input
                type="number"
                min="1"
                max="65535"
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
                disabled={mcpStatus.running}
                className={`w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-mac-body focus:outline-hidden focus:ring-1 focus:ring-blue-400 ${
                  mcpStatus.running ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
            </div>

            {/* Status line */}
            <div className="flex items-center gap-2 text-mac-small">
              <span className={`w-2 h-2 rounded-full ${mcpStatus.running ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-gray-500 dark:text-gray-400">
                {mcpLoading
                  ? 'Updating...'
                  : mcpStatus.running
                    ? `Running on http://127.0.0.1:${mcpStatus.port}/mcp`
                    : 'Stopped'}
              </span>
            </div>
          </div>
        </section>

        {/* Tools Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3 pr-4">
            <h2 className="text-mac-body font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
              Tools
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-mac-small text-gray-400 dark:text-gray-500">Set all:</span>
              <ToolModeControl
                state={(() => {
                  const enabled = mcpTools.filter((t) => t.enabled);
                  if (enabled.length === 0) return 'off';
                  if (enabled.length === mcpTools.length && enabled.every((t) => t.mode === enabled[0].mode))
                    return enabled[0].mode;
                  return 'notify';
                })()}
                onChange={handleSetAllState}
              />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-white/5 divide-y divide-gray-200 dark:divide-gray-700">
            {mcpTools.map((tool) => (
              <div key={tool.name} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 mr-3">
                  <div className={`text-mac-body font-medium font-mono text-sm ${!tool.enabled ? 'opacity-50' : ''}`}>
                    {tool.name}
                  </div>
                  <div className="text-mac-small text-gray-500 dark:text-gray-400 truncate">{tool.description}</div>
                </div>
                <ToolModeControl
                  state={tool.enabled ? tool.mode : 'off'}
                  onChange={(state) => handleToolStateChange(tool.name, state)}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-mac-small text-gray-400 dark:text-gray-500">
            Toggling a tool restarts the server for new sessions.
          </p>
        </section>

        {/* Tool Usage Section */}
        <section className="mb-8">
          <h2 className="text-mac-body font-semibold mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
            Tool Usage
          </h2>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-white/5 overflow-hidden">
            {toolStats.length === 0 ? (
              <div className="px-4 py-6 text-center text-mac-small text-gray-400 dark:text-gray-500">
                No usage data yet
              </div>
            ) : (
              <table className="w-full text-mac-small">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-left">
                    <th className="px-4 py-2 font-medium">Tool</th>
                    <th className="px-4 py-2 font-medium text-right">Calls</th>
                    <th className="px-4 py-2 font-medium text-right">Errors</th>
                    <th className="px-4 py-2 font-medium text-right">Avg (ms)</th>
                    <th className="px-4 py-2 font-medium text-right">Last called</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {toolStats.map((stat) => (
                    <tr key={stat.toolName}>
                      <td className="px-4 py-2 font-mono text-xs">{stat.toolName}</td>
                      <td className="px-4 py-2 text-right">{stat.totalCalls}</td>
                      <td className="px-4 py-2 text-right">
                        {stat.errorCount > 0 ? <span className="text-red-500">{stat.errorCount}</span> : '0'}
                      </td>
                      <td className="px-4 py-2 text-right">{stat.averageDurationMs}</td>
                      <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                        {stat.lastCalledAt ? new Date(stat.lastCalledAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* About */}
        <section className="mb-8 text-center">
          <button
            onClick={() => setShowAbout(true)}
            className="text-mac-small text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            About PaperShelf
          </button>
        </section>
      </div>

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  );
}
