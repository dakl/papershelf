import { test, expect } from './fixtures';

test('create a tag', async ({ window }) => {
  await window.getByTitle('New tag').click();
  await expect(window.getByText('New Tag')).toBeVisible();

  await window.getByPlaceholder('Tag name').fill('Transformers');
  await window.getByRole('button', { name: 'Create' }).click();

  await expect(window.getByText('Transformers')).toBeVisible();
  await expect(window.getByText('No tags yet')).not.toBeVisible();
});

test('navigate to empty tag view', async ({ window }) => {
  await window.getByTitle('New tag').click();
  await window.getByPlaceholder('Tag name').fill('Reinforcement Learning');
  await window.getByRole('button', { name: 'Create' }).click();

  await window.getByText('Reinforcement Learning').click();

  await expect(window.locator('h2').getByText('Reinforcement Learning')).toBeVisible();
});
