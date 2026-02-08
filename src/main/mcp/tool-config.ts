import fs from 'fs';
import path from 'path';
import { getDataDir } from '../paths';

interface ToolConfig {
  disabledTools: string[];
}

function getConfigPath(): string {
  return path.join(getDataDir(), 'mcp-tools.json');
}

function readConfig(): ToolConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { disabledTools: [] };
  }
}

function writeConfig(config: ToolConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

export function getDisabledTools(): string[] {
  return readConfig().disabledTools;
}

export function setDisabledTools(disabledTools: string[]): void {
  writeConfig({ disabledTools });
}
