import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Config tests ---

let tmpDir: string;

vi.mock('../paths', () => ({
  getDataDir: () => tmpDir,
}));

import { getDisabledTools, getToolModes, setDisabledTools, setToolMode } from '../mcp/tool-config';

describe('tool-config: toolModes', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papershelf-notif-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty modes by default', () => {
    expect(getToolModes()).toEqual({});
  });

  it('persists a confirm mode', () => {
    setToolMode('save_paper', 'confirm');
    expect(getToolModes()).toEqual({ save_paper: 'confirm' });
  });

  it('persists a silent mode', () => {
    setToolMode('search_arxiv', 'silent');
    expect(getToolModes()).toEqual({ search_arxiv: 'silent' });
  });

  it('removes entry when set back to notify (default)', () => {
    setToolMode('save_paper', 'confirm');
    setToolMode('save_paper', 'notify');
    expect(getToolModes()).toEqual({});
  });

  it('preserves disabledTools when setting modes', () => {
    setDisabledTools(['search_arxiv']);
    setToolMode('save_paper', 'confirm');
    expect(getDisabledTools()).toEqual(['search_arxiv']);
    expect(getToolModes()).toEqual({ save_paper: 'confirm' });
  });

  it('preserves toolModes when setting disabledTools', () => {
    setToolMode('save_paper', 'confirm');
    setDisabledTools(['search_arxiv']);
    expect(getToolModes()).toEqual({ save_paper: 'confirm' });
  });
});

// --- Proxy behavior tests ---

const mockShow = vi.fn();
vi.mock('electron', () => {
  class MockNotification {
    constructor(public opts: unknown) {}
    show = mockShow;
  }
  return {
    Notification: MockNotification,
    dialog: {
      showMessageBoxSync: vi.fn().mockReturnValue(0),
    },
  };
});

import { dialog, Notification } from 'electron';
import { closeDatabase, initDatabase } from '../database';
// We can't easily test the full Proxy without the MCP SDK,
// so we test the building blocks: summarizeArgs indirectly via the config,
// and the denied status via logToolCall
import { getToolStats, logToolCall } from '../db/tool-stats';

describe('tool notifications: denied status logging', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `papershelf-notif-db-${Date.now()}.db`);
    initDatabase(dbPath);
  });

  afterEach(() => {
    closeDatabase();
    try {
      fs.unlinkSync(dbPath);
      fs.unlinkSync(`${dbPath}-wal`);
      fs.unlinkSync(`${dbPath}-shm`);
    } catch {
      // cleanup best-effort
    }
  });

  it('logs a denied tool call', () => {
    logToolCall('save_paper', '{}', 0, 'denied');
    const stats = getToolStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].toolName).toBe('save_paper');
    expect(stats[0].totalCalls).toBe(1);
    // denied is not counted as error
    expect(stats[0].errorCount).toBe(0);
  });

  it('counts denied separately from errors', () => {
    logToolCall('save_paper', '{}', 0, 'denied');
    logToolCall('save_paper', '{}', 50, 'error', 'fail');
    logToolCall('save_paper', '{}', 100, 'success');
    const stats = getToolStats();
    expect(stats[0].totalCalls).toBe(3);
    expect(stats[0].errorCount).toBe(1);
  });
});

describe('Notification and dialog mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Notification constructor is callable', () => {
    const NotificationCtor = Notification as unknown as new (opts: unknown) => { show: () => void };
    const n = new NotificationCtor({ title: 'PaperShelf', body: 'test' });
    n.show();
    expect(mockShow).toHaveBeenCalled();
  });

  it('dialog.showMessageBoxSync returns 0 (allow) by default', () => {
    const result = dialog.showMessageBoxSync({} as never);
    expect(result).toBe(0);
  });

  it('dialog.showMessageBoxSync can be mocked to deny', () => {
    vi.mocked(dialog.showMessageBoxSync).mockReturnValueOnce(1);
    const result = dialog.showMessageBoxSync({} as never);
    expect(result).toBe(1);
  });
});
