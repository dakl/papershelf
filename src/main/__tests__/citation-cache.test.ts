import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import { closeDatabase, initDatabase, saveCitationBatch } from '../database';
import { isCitationCacheFresh } from '../services/citation-cache';

let dbPath: string;

function makeS2Paper(s2Id: string, arxivId: string | null = null) {
  return {
    s2Id,
    arxivId,
    title: `Paper ${s2Id}`,
    authors: ['Author'],
    year: 2024,
  };
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-cache-test-${Date.now()}.db`);
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

describe('isCitationCacheFresh', () => {
  it('returns false for unfetched paper', () => {
    expect(isCitationCacheFresh('unknown', 30)).toBe(false);
  });

  it('returns true for recently fetched paper', () => {
    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [], [], '2401.00001');
    expect(isCitationCacheFresh('2401.00001', 30)).toBe(true);
  });

  it('returns false when TTL is 0 days', () => {
    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [], [], '2401.00001');
    expect(isCitationCacheFresh('2401.00001', 0)).toBe(false);
  });

  it('returns true with a very long TTL', () => {
    saveCitationBatch(makeS2Paper('s1', '2401.00001'), [], [], '2401.00001');
    expect(isCitationCacheFresh('2401.00001', 36500)).toBe(true);
  });
});
