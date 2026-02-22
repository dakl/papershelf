import { test, expect } from './fixtures';

test('app window opens', async ({ electronApp, window }) => {
  const title = await window.title();
  expect(title).toBe('PaperShelf');

  const windowCount = await electronApp.windows();
  expect(windowCount.length).toBe(1);
});

test('sidebar renders default navigation', async ({ window }) => {
  await expect(window.getByRole('button', { name: 'My Library' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Favorites' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Recently Added' })).toBeVisible();
});

test('sidebar shows collections and tags sections', async ({ window }) => {
  await expect(window.getByText('Collections', { exact: true })).toBeVisible();
  await expect(window.getByText('Tags', { exact: true })).toBeVisible();
  await expect(window.getByText('No collections yet')).toBeVisible();
  await expect(window.getByText('No tags yet')).toBeVisible();
});

test('empty library shows placeholder', async ({ window }) => {
  await expect(window.getByText('No papers yet')).toBeVisible();
});

test('settings panel opens', async ({ window }) => {
  await window.getByLabel('Settings').click();
  await expect(window.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(window.getByText('MCP Server', { exact: true })).toBeVisible();
  await expect(window.getByRole('heading', { name: 'Tools' })).toBeVisible();
});
