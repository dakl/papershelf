import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

import { closeDatabase, initDatabase, insertPaper } from '../database';
import { readPdfForPaper } from '../services/pdf-reader';

let dbPath: string;

function makePaper(overrides: Partial<Parameters<typeof insertPaper>[0]> = {}) {
  return {
    arxivId: '2401.00001',
    title: 'Test Paper',
    authors: ['Author A'],
    abstract: 'Abstract text.',
    publishedDate: '2024-01-01T00:00:00Z',
    updatedDate: '2024-01-01T00:00:00Z',
    categories: ['cs.AI'],
    arxivUrl: 'https://arxiv.org/abs/2401.00001',
    pdfUrl: 'https://arxiv.org/pdf/2401.00001',
    pdfPath: null,
    fullText: null,
    ...overrides,
  };
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-pdf-test-${Date.now()}.db`);
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  try {
    fs.unlinkSync(dbPath);
  } catch {}
});

describe('readPdfForPaper', () => {
  it('returns ArrayBuffer when paper exists and PDF file is on disk', () => {
    const pdfPath = path.join(os.tmpdir(), `test-${Date.now()}.pdf`);
    const pdfContent = Buffer.from('%PDF-1.4 fake pdf content');
    fs.writeFileSync(pdfPath, pdfContent);

    try {
      const paper = insertPaper(makePaper({ pdfPath }));
      const result = readPdfForPaper(paper.id);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toEqual(pdfContent);
    } finally {
      fs.unlinkSync(pdfPath);
    }
  });

  it('returns null when pdfPath is null', () => {
    const paper = insertPaper(makePaper({ pdfPath: null }));
    const result = readPdfForPaper(paper.id);
    expect(result).toBeNull();
  });

  it('returns null when file does not exist on disk', () => {
    const paper = insertPaper(makePaper({ pdfPath: '/nonexistent/path/to.pdf' }));
    const result = readPdfForPaper(paper.id);
    expect(result).toBeNull();
  });

  it('returns null for non-existent paper ID', () => {
    const result = readPdfForPaper('nonexistent-id');
    expect(result).toBeNull();
  });
});
