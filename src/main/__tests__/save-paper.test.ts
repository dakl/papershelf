import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths', () => ({
  getDataDir: () => '',
}));

vi.mock('../pdf-processor', () => ({
  downloadAndExtractPdf: vi.fn(),
}));

import { closeDatabase, getPaperByArxivId, initDatabase, insertPaper } from '../database';
import { downloadAndExtractPdf } from '../pdf-processor';
import { savePaperFromArxivPaper } from '../services/save-paper';

const mockedDownload = vi.mocked(downloadAndExtractPdf);

let dbPath: string;

function makeArxivPaper(overrides: Record<string, unknown> = {}) {
  return {
    id: '2401.00001',
    title: 'Test Paper',
    authors: ['Author One', 'Author Two'],
    abstract: 'Abstract text.',
    publishedDate: '2024-01-01T00:00:00Z',
    updatedDate: '2024-01-01T00:00:00Z',
    categories: ['cs.AI'],
    arxivUrl: 'https://arxiv.org/abs/2401.00001',
    pdfUrl: 'https://arxiv.org/pdf/2401.00001',
    ...overrides,
  };
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `papershelf-save-test-${Date.now()}.db`);
  initDatabase(dbPath);
  mockedDownload.mockReset();
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

describe('savePaperFromArxivPaper', () => {
  it('saves a new paper and returns it', async () => {
    mockedDownload.mockResolvedValue({ pdfPath: '/tmp/paper.pdf', fullText: 'extracted text' });

    const result = await savePaperFromArxivPaper(makeArxivPaper());

    expect(result.alreadyExisted).toBe(false);
    expect(result.paper.arxivId).toBe('2401.00001');
    expect(result.paper.title).toBe('Test Paper');
    expect(result.pdfDownloaded).toBe(true);
    expect(result.textExtracted).toBe(true);
  });

  it('returns existing paper without downloading', async () => {
    insertPaper({
      arxivId: '2401.00001',
      title: 'Existing Paper',
      authors: ['Author'],
      abstract: 'Abstract',
      publishedDate: '2024-01-01T00:00:00Z',
      updatedDate: '2024-01-01T00:00:00Z',
      categories: ['cs.AI'],
      arxivUrl: 'https://arxiv.org/abs/2401.00001',
      pdfUrl: 'https://arxiv.org/pdf/2401.00001',
      pdfPath: null,
      fullText: null,
    });

    const result = await savePaperFromArxivPaper(makeArxivPaper());

    expect(result.alreadyExisted).toBe(true);
    expect(result.paper.title).toBe('Existing Paper');
    expect(mockedDownload).not.toHaveBeenCalled();
  });

  it('saves paper even if PDF download fails', async () => {
    mockedDownload.mockRejectedValue(new Error('Download failed'));

    const result = await savePaperFromArxivPaper(makeArxivPaper());

    expect(result.alreadyExisted).toBe(false);
    expect(result.paper.arxivId).toBe('2401.00001');
    expect(result.pdfDownloaded).toBe(false);
    expect(result.textExtracted).toBe(false);
  });

  it('handles paper without pdfUrl', async () => {
    const result = await savePaperFromArxivPaper(makeArxivPaper({ pdfUrl: '' }));

    expect(result.alreadyExisted).toBe(false);
    expect(result.pdfDownloaded).toBe(false);
    expect(mockedDownload).not.toHaveBeenCalled();
  });

  it('reports pdfDownloaded=true but textExtracted=false when no text', async () => {
    mockedDownload.mockResolvedValue({ pdfPath: '/tmp/paper.pdf', fullText: null });

    const result = await savePaperFromArxivPaper(makeArxivPaper());

    expect(result.pdfDownloaded).toBe(true);
    expect(result.textExtracted).toBe(false);
  });

  it('persists the paper in the database', async () => {
    mockedDownload.mockResolvedValue({ pdfPath: '/tmp/paper.pdf', fullText: 'text' });

    await savePaperFromArxivPaper(makeArxivPaper());

    const found = getPaperByArxivId('2401.00001');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Test Paper');
    expect(found!.pdfPath).toBe('/tmp/paper.pdf');
    expect(found!.fullText).toBe('text');
  });
});
