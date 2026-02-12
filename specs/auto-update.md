# Auto-Update via Public Releases Repo

## Overview

Add automatic update checking to PaperShelf using `electron-updater` and a separate **public** GitHub repo (`dakl/papershelf-releases`) for hosting release artifacts. The source code stays private in `dakl/papershelf`.

## Architecture

```
dakl/papershelf (private)          dakl/papershelf-releases (public)
  CI builds + signs app  ──────►   GitHub Release v0.3.0
                                     ├── PaperShelf-0.3.0-arm64.zip
                                     ├── PaperShelf-0.3.0-arm64.dmg
                                     └── latest-mac.yml

  PaperShelf app (running)  ◄────  electron-updater checks releases
```

- `electron-updater` reads `latest-mac.yml` from the public repo to determine if a new version is available.
- Updates are applied from the `.zip` artifact (required for macOS auto-update; dmg is for manual download).
- No GitHub token needed in the app since the releases repo is public.

## Prerequisites

1. Create public repo `dakl/papershelf-releases` on GitHub (empty, no code).
2. Create a GitHub PAT (fine-grained) with **Contents: Read and Write** permission scoped to `dakl/papershelf-releases` only. Add it as a secret `RELEASES_GITHUB_TOKEN` in the private repo.

## Changes

### 1. Install `electron-updater`

```bash
npm install electron-updater
```

This is a **runtime** dependency (not dev), since it runs in the packaged app.

### 2. Update `electron-builder.yml`

Add a `publish` section pointing to the public releases repo:

```yaml
publish:
  provider: github
  owner: dakl
  repo: papershelf-releases
```

This tells electron-builder to generate `latest-mac.yml` with the correct repo coordinates, and tells `electron-updater` where to check for updates at runtime.

### 3. Add auto-updater module

Create `src/main/auto-updater.ts`:

```typescript
import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';

export function initAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', async (info) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return;

    const { response } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available.`,
      detail: 'Would you like to download it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
    });

    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return;

    const { response } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update has been downloaded.',
      detail: 'It will be installed when you quit the app. Restart now?',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-update error:', error.message);
  });

  // Check for updates shortly after launch (only in packaged app)
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    console.warn('Update check failed:', err instanceof Error ? err.message : err);
  });
}
```

### 4. Wire into `src/main/index.ts`

After `createWindow()` in the `app.whenReady()` block:

```typescript
if (app.isPackaged) {
  const { initAutoUpdater } = await import('./auto-updater.js');
  initAutoUpdater();
}
```

Only runs in production — avoids update checks during `npm run dev`.

### 5. Update `release.yml`

Replace the current manual release step with electron-builder's built-in publish. The key changes:

**a)** In the "Package" step, change `--publish never` to `--publish always`:

```yaml
- name: Package and publish
  env:
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    GH_TOKEN: ${{ secrets.RELEASES_GITHUB_TOKEN }}
  run: npx electron-builder --mac --arm64 --publish always
```

`GH_TOKEN` is read by electron-builder to publish the release (with `latest-mac.yml` + artifacts) to `dakl/papershelf-releases`.

**b)** Remove the `softprops/action-gh-release` step — electron-builder handles release creation.

**c)** Optionally keep a separate step to also create a release on the private repo (for release notes / changelog tracking), or just rely on git tags.

### 6. TypeScript config

`electron-updater` ships its own types. No additional `@types/` package needed. Ensure `src/main/auto-updater.ts` is included in `tsconfig.main.json` (it should be already if it covers `src/main/**/*`).

## Release Flow (after implementation)

1. Trigger "Release" workflow in `dakl/papershelf` with version string.
2. CI builds, signs, notarizes.
3. electron-builder publishes release to `dakl/papershelf-releases` with `latest-mac.yml`.
4. Running PaperShelf instances check `dakl/papershelf-releases` on launch and notify user of updates.

## Open Questions

- **Check frequency**: Currently checks once on launch. Could add a periodic check (e.g. every 6 hours) or a manual "Check for Updates" menu item.
- **Release notes**: Should the update dialog show release notes? `info.releaseNotes` is available from electron-updater.
- **Intel builds**: Currently arm64 only. If x64 support is added later, `latest-mac.yml` handles multi-arch automatically.
