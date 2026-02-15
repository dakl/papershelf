import { test, expect } from './fixtures';

test('seeded paper appears in library', async ({ electronApp, window }) => {
  await electronApp.evaluate(async () => {
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
      pdfPath: null,
      fullText: null,
    });
  });

  await window.getByRole('button', { name: 'My Library' }).click();
  await expect(window.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });
});

test('favorite a seeded paper', async ({ electronApp, window }) => {
  await electronApp.evaluate(async () => {
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
      pdfPath: null,
      fullText: null,
    });
  });

  await window.getByRole('button', { name: 'My Library' }).click();
  await expect(window.getByText('Language Models are Few-Shot Learners')).toBeVisible({ timeout: 5000 });

  await window.getByText('Language Models are Few-Shot Learners').click();
  await window.getByTitle('Add to favorites').click();

  await window.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(window.getByText('Language Models are Few-Shot Learners').first()).toBeVisible();
});
