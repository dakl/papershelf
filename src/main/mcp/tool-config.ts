import fs from 'fs';
import path from 'path';
import type { ToolNotificationMode } from '../../shared/types';
import { getDataDir } from '../paths';

interface ToolConfig {
  disabledTools: string[];
  toolModes: Record<string, ToolNotificationMode>;
}

function getConfigPath(): string {
  return path.join(getDataDir(), 'mcp-tools.json');
}

function readConfig(): ToolConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      disabledTools: parsed.disabledTools ?? [],
      toolModes: parsed.toolModes ?? {},
    };
  } catch {
    return { disabledTools: [], toolModes: {} };
  }
}

function writeConfig(config: ToolConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

export function getDisabledTools(): string[] {
  return readConfig().disabledTools;
}

export function setDisabledTools(disabledTools: string[]): void {
  const config = readConfig();
  writeConfig({ ...config, disabledTools });
}

export function getToolModes(): Record<string, ToolNotificationMode> {
  return readConfig().toolModes;
}

export function setToolMode(toolName: string, mode: ToolNotificationMode): void {
  const config = readConfig();
  if (mode === 'notify') {
    delete config.toolModes[toolName];
  } else {
    config.toolModes[toolName] = mode;
  }
  writeConfig(config);
}
