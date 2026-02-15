import { test, expect } from './fixtures';

test('search view renders with arXiv mode', async ({ window }) => {
  await window.getByRole('button', { name: 'Search' }).click();
  await expect(window.getByPlaceholder('Search arXiv papers...')).toBeVisible();
  await expect(window.getByRole('button', { name: 'arXiv' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Library', exact: true })).toBeVisible();
});

test('switch between arXiv and Library search modes', async ({ window }) => {
  await window.getByRole('button', { name: 'Search' }).click();

  await window.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(window.getByPlaceholder('Search your library...')).toBeVisible();

  await window.getByRole('button', { name: 'arXiv' }).click();
  await expect(window.getByPlaceholder('Search arXiv papers...')).toBeVisible();
});

test('library search on empty library shows placeholder', async ({ window }) => {
  await window.getByRole('button', { name: 'Search' }).click();
  await window.getByRole('button', { name: 'Library', exact: true }).click();

  await window.getByPlaceholder('Search your library...').fill('test query');
  await window.locator('form').getByRole('button', { name: 'Search' }).click();

  await expect(window.getByText('Search your saved papers')).toBeVisible();
});
