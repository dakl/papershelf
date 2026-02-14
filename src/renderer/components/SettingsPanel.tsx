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
          className={`px-3 py-0.5 text-[11px] text-center transition-colors ${
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
      className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
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
              className="flex items-center justify-between px-3 py-1 mx-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className="text-mac-small">{shortcut.label}</span>
              <div className="flex items-center gap-1.5">
                {isRecording && conflict && <span className="text-[11px] text-red-500">Used by {conflict}</span>}
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
                    className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
  }, []);

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
                className={`w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-mac-body focus:outline-none focus:ring-1 focus:ring-blue-400 ${
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
              <span className="text-[11px] text-gray-400 dark:text-gray-500">Set all:</span>
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
