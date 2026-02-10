import fs from 'fs';
import os from 'os';
import path from 'path';

export function getDataDir(): string {
  const envDir = process.env.PAPERSHELF_DATA_DIR;
  if (envDir) {
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true });
    }
    return envDir;
  }

  try {
    const { app } = require('electron');
    return app.getPath('userData');
  } catch {
    const dir = path.join(os.homedir(), '.papershelf');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
}
