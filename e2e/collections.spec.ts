import { test, expect } from './fixtures';

test('create a collection', async ({ window }) => {
  await window.getByTitle('New collection').click();
  await expect(window.getByText('New Collection')).toBeVisible();

  await window.getByPlaceholder('Collection name').fill('Machine Learning');
  await window.getByRole('button', { name: 'Create' }).click();

  await expect(window.getByText('Machine Learning')).toBeVisible();
  await expect(window.getByText('No collections yet')).not.toBeVisible();
});

test('navigate to empty collection', async ({ window }) => {
  await window.getByTitle('New collection').click();
  await window.getByPlaceholder('Collection name').fill('NLP Papers');
  await window.getByRole('button', { name: 'Create' }).click();

  await window.getByText('NLP Papers').click();

  await expect(window.locator('h2').getByText('NLP Papers')).toBeVisible();
});
