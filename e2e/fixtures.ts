import { test as base, _electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

type TestFixtures = {
  electronApp: ElectronApplication;
  window: Page;
};

export const test = base.extend<TestFixtures>({
  electronApp: async ({}, use) => {
    const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papershelf-e2e-'));

    const electronApp = await _electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main', 'main', 'index.js')],
      env: {
        ...process.env,
        PAPERSHELF_DATA_DIR: testDataDir,
        PAPERSHELF_E2E: '1',
      },
    });

    await use(electronApp);

    await electronApp.close();

    fs.rmSync(testDataDir, { recursive: true, force: true });
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect } from '@playwright/test';
