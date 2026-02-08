import path from 'path';
import os from 'os';
import fs from 'fs';

export function getDataDir(): string {
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
