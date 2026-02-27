import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect, test } from './fixtures';
import { createTestPdf } from './helpers/create-test-pdf';

let pdfDir: string;
let pdfPath: string;

test.beforeAll(async () => {
  pdfDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papershelf-pdf-'));
  pdfPath = await createTestPdf(pdfDir);
});

test.afterAll(() => {
  fs.rmSync(pdfDir, { recursive: true, force: true });
});

test('Cmd+F opens search bar in PDF viewer', async ({ electronApp, window }) => {
  // Seed a paper with a local PDF
  await electronApp.evaluate(
    async ({ pdfFilePath }) => {
      const db = (global as Record<string, any>).__papershelf_db;
      db.insertPaper({
        arxivId: '1706.03762',
        title: 'Attention Is All You Need',
        authors: ['Ashish Vaswani', 'Noam Shazeer'],
        abstract: 'The dominant sequence transduction models are based on complex recurrent neural networks.',
        publishedDate: '2017-06-12T00:00:00Z',
        updatedDate: '2017-06-12T00:00:00Z',
        categories: ['cs.CL', 'cs.AI'],
        arxivUrl: 'https://arxiv.org/abs/1706.03762',
        pdfUrl: 'https://arxiv.org/pdf/1706.03762',
        pdfPath: pdfFilePath,
        fullText: null,
      });
    },
    { pdfFilePath: pdfPath },
  );

  // Navigate to library and click the paper
  await window.getByRole('button', { name: 'My Library' }).click();
  await expect(window.getByText('Attention Is All You Need').first()).toBeVisible({ timeout: 5000 });
  await window.getByText('Attention Is All You Need').first().click();

  // Wait for PDF to render (text layer spans appear)
  await window.locator('.textLayer span').first().waitFor({ timeout: 10000 });

  // Take a screenshot of the PDF viewer before search
  await window.screenshot({ path: 'test-results/pdf-viewer-before-search.png' });

  // Open search with Cmd+F
  await window.keyboard.press('Meta+f');

  // Search bar should be visible
  const searchInput = window.getByPlaceholder('Find in PDF...');
  await expect(searchInput).toBeVisible({ timeout: 3000 });

  // Take screenshot showing search bar open
  await window.screenshot({ path: 'test-results/pdf-search-bar-open.png' });

  // Type a search query
  await searchInput.fill('attention');

  // Wait for match counter to appear
  await expect(window.getByText(/\d+ of \d+/)).toBeVisible({ timeout: 3000 });

  // Take screenshot showing search results
  await window.screenshot({ path: 'test-results/pdf-search-results.png' });

  // Navigate to next match with Enter
  await searchInput.press('Enter');
  await window.screenshot({ path: 'test-results/pdf-search-next-match.png' });

  // Close search with Escape
  await searchInput.press('Escape');
  await expect(searchInput).not.toBeVisible();

  // Take screenshot after closing search (highlights should be gone)
  await window.screenshot({ path: 'test-results/pdf-search-closed.png' });
});
