import { useEffect } from 'react';
import { usePaperStore } from '../stores/paperStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { GearIcon, ServerRackIcon, SidebarLeftIcon, TrayArrowDownIcon } from './Icons';
import { ShortcutHint } from './ShortcutHint';

const toolbarButtonClass =
  'no-drag w-[28px] h-[28px] flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-500 dark:text-gray-400';

export function Toolbar() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const sidebarView = useUIStore((state) => state.sidebarView);
  const setSidebarView = useUIStore((state) => state.setSidebarView);
  const importLocalPdfs = usePaperStore((state) => state.importLocalPdfs);
  const { mcpStatus, mcpLoading, toggleMcpServer, loadMcpStatus } = useSettingsStore();

  useEffect(() => {
    loadMcpStatus();
  }, [loadMcpStatus]);

  return (
    <div className="drag-region h-[38px] shrink-0 relative px-2 border-b border-transparent">
      <div className="absolute flex items-center gap-1" style={{ top: 8, right: 12 }}>
        <ShortcutHint
          shortcutId="toggleSidebar"
          position="below"
          label={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
        >
          <button onClick={toggleSidebar} className={toolbarButtonClass}>
            <SidebarLeftIcon width={16} height={16} />
          </button>
        </ShortcutHint>

        <ShortcutHint
          shortcutId="toggleMcp"
          position="below"
          label={mcpStatus.running ? 'Stop MCP Server' : 'Start MCP Server'}
        >
          <button
            onClick={() => toggleMcpServer(mcpStatus.port)}
            disabled={mcpLoading}
            className={`relative ${toolbarButtonClass} ${mcpLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ServerRackIcon width={16} height={16} />
            <span
              className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${mcpStatus.running ? 'bg-green-500' : 'bg-red-500'}`}
            />
          </button>
        </ShortcutHint>

        <ShortcutHint shortcutId="importPdfs" position="below" label="Import PDFs">
          <button onClick={() => importLocalPdfs()} className={toolbarButtonClass}>
            <TrayArrowDownIcon width={16} height={16} />
          </button>
        </ShortcutHint>

        <ShortcutHint shortcutId="toggleSettings" position="below" align="end" label="Settings">
          <button
            onClick={() => setSidebarView('settings')}
            className={`${toolbarButtonClass} ${sidebarView === 'settings' ? 'text-gray-800 dark:text-gray-200' : ''}`}
          >
            <GearIcon width={16} height={16} />
          </button>
        </ShortcutHint>
      </div>
    </div>
  );
}
