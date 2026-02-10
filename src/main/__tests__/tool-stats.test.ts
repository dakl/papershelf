import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import { closeDatabase, initDatabase } from '../database';
import { getToolStats, logToolCall } from '../db/tool-stats';

let dbPath: string;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-tool-stats-test-${Date.now()}.db`);
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

describe('logToolCall', () => {
  it('inserts a successful tool call', () => {
    logToolCall('search_arxiv', '{"query":"test"}', 150, 'success');
    const stats = getToolStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].toolName).toBe('search_arxiv');
    expect(stats[0].totalCalls).toBe(1);
    expect(stats[0].errorCount).toBe(0);
    expect(stats[0].averageDurationMs).toBe(150);
  });

  it('inserts an error tool call', () => {
    logToolCall('save_paper', '{}', 50, 'error', 'Paper not found');
    const stats = getToolStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].errorCount).toBe(1);
  });

  it('accumulates multiple calls for the same tool', () => {
    logToolCall('search_arxiv', '{}', 100, 'success');
    logToolCall('search_arxiv', '{}', 200, 'success');
    logToolCall('search_arxiv', '{}', 300, 'error', 'timeout');
    const stats = getToolStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].totalCalls).toBe(3);
    expect(stats[0].errorCount).toBe(1);
    expect(stats[0].averageDurationMs).toBe(200);
  });
});

describe('getToolStats', () => {
  it('returns empty array when no calls logged', () => {
    expect(getToolStats()).toEqual([]);
  });

  it('returns stats sorted by total calls descending', () => {
    logToolCall('list_papers', '{}', 10, 'success');
    logToolCall('search_arxiv', '{}', 10, 'success');
    logToolCall('search_arxiv', '{}', 10, 'success');
    logToolCall('save_paper', '{}', 10, 'success');
    logToolCall('save_paper', '{}', 10, 'success');
    logToolCall('save_paper', '{}', 10, 'success');

    const stats = getToolStats();
    expect(stats).toHaveLength(3);
    expect(stats[0].toolName).toBe('save_paper');
    expect(stats[0].totalCalls).toBe(3);
    expect(stats[1].toolName).toBe('search_arxiv');
    expect(stats[1].totalCalls).toBe(2);
    expect(stats[2].toolName).toBe('list_papers');
    expect(stats[2].totalCalls).toBe(1);
  });

  it('includes lastCalledAt timestamp', () => {
    logToolCall('search_arxiv', '{}', 10, 'success');
    const stats = getToolStats();
    expect(stats[0].lastCalledAt).toBeTruthy();
  });
});
