import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths';

const SETTINGS_FILE = 'settings.json';

interface AppSettings {
  shortcuts?: Record<string, string>;
  pdfLibraryPath?: string;
}

function getSettingsPath(): string {
  return path.join(getDataDir(), SETTINGS_FILE);
}

export function loadSettings(): AppSettings {
  try {
    const filePath = getSettingsPath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    // ignore corrupt file
  }
  return {};
}

export function saveSettings(settings: AppSettings): void {
  const filePath = getSettingsPath();
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

export function getShortcutOverrides(): Record<string, string> {
  return loadSettings().shortcuts ?? {};
}

export function saveShortcutOverrides(overrides: Record<string, string>): void {
  const settings = loadSettings();
  if (Object.keys(overrides).length === 0) {
    delete settings.shortcuts;
  } else {
    settings.shortcuts = overrides;
  }
  saveSettings(settings);
}

export function getPdfLibraryPath(): string | null {
  return loadSettings().pdfLibraryPath ?? null;
}

export function setPdfLibraryPath(libraryPath: string | null): void {
  const settings = loadSettings();
  if (libraryPath) {
    settings.pdfLibraryPath = libraryPath;
  } else {
    delete settings.pdfLibraryPath;
  }
  saveSettings(settings);
}
