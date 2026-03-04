import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { test, expect } from './fixtures';

/** Create a minimal single-page PDF and return the temp file path. */
async function createTempPdf(text: string): Promise<{ pdfPath: string; tmpDir: string }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText(text, { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  const pdfBytes = await doc.save();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papershelf-lib-'));
  const pdfPath = path.join(tmpDir, 'test.pdf');
  fs.writeFileSync(pdfPath, pdfBytes);
  return { pdfPath, tmpDir };
}

test('seeded paper appears in library', async ({ electronApp, window }) => {
  const { pdfPath, tmpDir } = await createTempPdf('Attention Is All You Need');
  try {
    await electronApp.evaluate(
      async (_electron, _params: { pdfPath: string }) => {
        const db = (global as Record<string, any>).__papershelf_db;
        db.insertPaper({
          arxivId: '1706.03762',
          title: 'Attention Is All You Need',
          authors: ['Ashish Vaswani', 'Noam Shazeer'],
          abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
          publishedDate: '2017-06-12T00:00:00Z',
          updatedDate: '2017-06-12T00:00:00Z',
          categories: ['cs.CL', 'cs.AI'],
          arxivUrl: 'https://arxiv.org/abs/1706.03762',
          pdfUrl: 'https://arxiv.org/pdf/1706.03762',
          pdfPath: _params.pdfPath,
          fullText: null,
        });
      },
      { pdfPath },
    );

    await window.getByRole('button', { name: 'My Library' }).click();
    await expect(window.getByText('Attention Is All You Need').first()).toBeVisible({ timeout: 5000 });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('favorite a seeded paper', async ({ electronApp, window }) => {
  const { pdfPath, tmpDir } = await createTempPdf('Language Models are Few-Shot Learners');
  try {
    await electronApp.evaluate(
      async (_electron, _params: { pdfPath: string }) => {
        const db = (global as Record<string, any>).__papershelf_db;
        db.insertPaper({
          arxivId: '2005.14165',
          title: 'Language Models are Few-Shot Learners',
          authors: ['Tom Brown'],
          abstract: 'Recent work has demonstrated substantial gains on many NLP tasks.',
          publishedDate: '2020-05-28T00:00:00Z',
          updatedDate: '2020-05-28T00:00:00Z',
          categories: ['cs.CL'],
          arxivUrl: 'https://arxiv.org/abs/2005.14165',
          pdfUrl: 'https://arxiv.org/pdf/2005.14165',
          pdfPath: _params.pdfPath,
          fullText: null,
        });
      },
      { pdfPath },
    );

    await window.getByRole('button', { name: 'My Library' }).click();
    await expect(window.getByText('Language Models are Few-Shot Learners').first()).toBeVisible({ timeout: 5000 });

    await window.getByText('Language Models are Few-Shot Learners').first().click();

    // Wait for PDF to render before interacting with toolbar buttons
    await window.locator('.textLayer span').first().waitFor({ timeout: 30000 });

    await window.getByTitle(/Add to favorites/).click();
    await window.getByTitle(/Remove from favorites/).waitFor({ timeout: 5000 });

    // Navigate to Favorites view via the sidebar
    const favoritesButton = window.locator('nav button', { hasText: 'Favorites' });
    await favoritesButton.waitFor({ state: 'visible', timeout: 5000 });
    await favoritesButton.click();
    await expect(window.getByText('Language Models are Few-Shot Learners').first()).toBeVisible({ timeout: 5000 });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
