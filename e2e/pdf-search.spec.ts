import { expect, test } from './fixtures';

test('Cmd+F opens search bar in PDF viewer', async ({ electronApp, window }) => {
  // Create a test PDF and seed a paper — all inside the main process to avoid path issues
  await electronApp.evaluate(async () => {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);
    const lines = [
      { text: 'Attention Is All You Need', size: 18 },
      { text: '', size: 11 },
      { text: 'Abstract', size: 14 },
      { text: '', size: 11 },
      { text: 'The dominant sequence transduction models are based on complex recurrent', size: 11 },
      { text: 'or convolutional neural networks that include an encoder and a decoder.', size: 11 },
      { text: 'We propose a new simple network architecture, the Transformer, based', size: 11 },
      { text: 'solely on attention mechanisms, dispensing with recurrence entirely.', size: 11 },
    ];
    let y = 720;
    for (const line of lines) {
      page.drawText(line.text, { x: 72, y, size: line.size, font, color: rgb(0, 0, 0) });
      y -= line.size + 6;
    }
    const pdfBytes = await doc.save();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papershelf-pdf-'));
    const pdfPath = path.join(tmpDir, 'test-paper.pdf');
    fs.writeFileSync(pdfPath, pdfBytes);

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
      pdfPath,
      fullText: null,
    });
  });

  // Navigate to library and click the paper
  await window.getByRole('button', { name: 'My Library' }).click();
  await expect(window.getByText('Attention Is All You Need').first()).toBeVisible({ timeout: 5000 });
  await window.getByText('Attention Is All You Need').first().click();

  // Wait for PDF to fully render — "Loading PDF..." should disappear
  await expect(window.getByText('Loading PDF...')).toBeVisible({ timeout: 5000 });
  await expect(window.getByText('Loading PDF...')).not.toBeVisible({ timeout: 15000 });

  // Verify we didn't get an error (e.g., "PDF file not found")
  const errorVisible = await window
    .getByText('PDF file not found')
    .isVisible()
    .catch(() => false);
  if (errorVisible) {
    throw new Error('PDF failed to load — file not found');
  }

  // Wait for text layer to render
  await window.locator('.textLayer span').first().waitFor({ timeout: 15000 });

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
  await expect(window.getByText(/\d+ of \d+/)).toBeVisible({ timeout: 5000 });

  // Take screenshot showing search results with highlights
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
