import { create } from 'zustand';
import type { McpServerStatus, McpToolInfo, ToolCallStats, ToolNotificationMode } from '../../shared/types';

interface SettingsState {
  mcpStatus: McpServerStatus;
  mcpLoading: boolean;
  mcpTools: McpToolInfo[];
  toolStats: ToolCallStats[];
  loadMcpStatus: () => Promise<void>;
  startMcpServer: (port: number) => Promise<void>;
  stopMcpServer: () => Promise<void>;
  toggleMcpServer: (port: number) => Promise<void>;
  loadMcpTools: () => Promise<void>;
  setToolEnabled: (toolName: string, enabled: boolean) => Promise<void>;
  setToolMode: (toolName: string, mode: ToolNotificationMode) => Promise<void>;
  loadToolStats: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  mcpStatus: { running: false, port: 3847 },
  mcpLoading: false,
  mcpTools: [],
  toolStats: [],

  loadMcpStatus: async () => {
    const status = await window.electronAPI.getMcpStatus();
    set({ mcpStatus: status });
  },

  startMcpServer: async (port: number) => {
    set({ mcpLoading: true });
    try {
      await window.electronAPI.startMcpServer(port);
      await get().loadMcpStatus();
    } finally {
      set({ mcpLoading: false });
    }
  },

  stopMcpServer: async () => {
    set({ mcpLoading: true });
    try {
      await window.electronAPI.stopMcpServer();
      await get().loadMcpStatus();
    } finally {
      set({ mcpLoading: false });
    }
  },

  toggleMcpServer: async (port: number) => {
    const { mcpStatus } = get();
    if (mcpStatus.running) {
      await get().stopMcpServer();
    } else {
      await get().startMcpServer(port);
    }
  },

  loadMcpTools: async () => {
    const tools = await window.electronAPI.getMcpTools();
    set({ mcpTools: tools });
  },

  setToolEnabled: async (toolName: string, enabled: boolean) => {
    // Optimistic update
    set((state) => ({
      mcpTools: state.mcpTools.map((t) => (t.name === toolName ? { ...t, enabled } : t)),
    }));
    await window.electronAPI.setMcpToolEnabled(toolName, enabled);
    await get().loadMcpStatus();
  },

  setToolMode: async (toolName: string, mode: ToolNotificationMode) => {
    set((state) => ({
      mcpTools: state.mcpTools.map((t) => (t.name === toolName ? { ...t, mode } : t)),
    }));
    await window.electronAPI.setMcpToolMode(toolName, mode);
    await get().loadMcpStatus();
  },

  loadToolStats: async () => {
    const toolStats = await window.electronAPI.getToolStats();
    set({ toolStats });
  },
}));
