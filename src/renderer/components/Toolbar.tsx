import { formatKeys, useShortcutStore } from '../stores/shortcutStore';
import { useUIStore } from '../stores/uiStore';

export function Toolbar() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebarShortcut = useShortcutStore((state) => state.getShortcut('toggleSidebar'));

  const shortcutHint = toggleSidebarShortcut ? ` (${formatKeys(toggleSidebarShortcut.keys)})` : '';

  return (
    <div className="drag-region h-[38px] flex-shrink-0 relative px-2 border-b border-transparent">
      {/* Position button to vertically align with traffic lights (y:16 + 6px center = 22px) */}
      <button
        onClick={toggleSidebar}
        style={{ top: 10, left: 76 }}
        className="no-drag absolute w-[28px] h-[28px] flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-500 dark:text-gray-400"
        title={`${sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}${shortcutHint}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <line x1="5.5" y1="2" x2="5.5" y2="14" />
        </svg>
      </button>
    </div>
  );
}
