import type React from 'react';
import { useEffect, useState } from 'react';
import { SIDEBAR_TRANSITION_MS, SIDEBAR_WIDTH } from '../constants';
import { usePaperStore } from '../stores/paperStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatKeys, useShortcutStore } from '../stores/shortcutStore';
import { toast } from '../stores/toastStore';
import { type SidebarView, useUIStore } from '../stores/uiStore';
import { CollectionManager } from './CollectionManager';
import { ClockIcon, DocTextIcon, SearchIcon, StarIcon } from './Icons';
import { ShortcutHint } from './ShortcutHint';
import { SidebarItem } from './SidebarItem';
import { TagManager } from './TagManager';

const NAV_ITEMS: {
  id: SidebarView;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  shortcutId: string;
}[] = [
  { id: 'all-papers', label: 'My Library', icon: DocTextIcon, shortcutId: 'goAllPapers' },
  { id: 'search', label: 'Search', icon: SearchIcon, shortcutId: 'goSearch' },
  { id: 'favorites', label: 'Favorites', icon: StarIcon, shortcutId: 'goFavorites' },
  { id: 'recent', label: 'Recently Added', icon: ClockIcon, shortcutId: 'goRecent' },
];

export function Sidebar() {
  const {
    sidebarView,
    setSidebarView,
    navigateToCollection,
    navigateToTag,
    selectedCollectionId,
    selectedTagId,
    sidebarCollapsed,
  } = useUIStore();
  const {
    collections,
    tags,
    libraryStats,
    loadCollections,
    loadTags,
    loadLibraryStats,
    updateCollection,
    updateTag,
    deleteCollection,
    deleteTag,
    addPaperToCollection,
  } = usePaperStore();
  const { mcpStatus, mcpLoading, loadMcpStatus, toggleMcpServer } = useSettingsStore();
  const commandDown = useShortcutStore((s) => s.commandDown);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [editCollection, setEditCollection] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editTag, setEditTag] = useState<{ id: string; name: string; color: string } | null>(null);

  useEffect(() => {
    loadCollections();
    loadTags();
    loadLibraryStats();
    loadMcpStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteCollection = (id: string) => {
    if (sidebarView === 'collection' && selectedCollectionId === id) {
      setSidebarView('all-papers');
    }
    deleteCollection(id);
  };

  const handleDeleteTag = (id: string) => {
    if (sidebarView === 'tag' && selectedTagId === id) {
      setSidebarView('all-papers');
    }
    deleteTag(id);
  };

  const sidebarWidth = sidebarCollapsed ? 0 : SIDEBAR_WIDTH;

  return (
    <aside
      className="shrink-0 border-r sidebar-separator flex flex-col bg-transparent overflow-hidden"
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        transition: `width ${SIDEBAR_TRANSITION_MS}ms ease-out, min-width ${SIDEBAR_TRANSITION_MS}ms ease-out`,
      }}
    >
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const shortcut = useShortcutStore.getState().getShortcut(item.shortcutId);
          return (
            <button
              key={item.id}
              onClick={() => setSidebarView(item.id)}
              className={`no-drag w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mac-body text-left transition-colors ${
                sidebarView === item.id ? 'bg-mac-selection font-medium' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {!commandDown && item.id === 'all-papers' && libraryStats != null && (
                <span className="text-mac-small text-gray-400">{libraryStats.paperCount}</span>
              )}
              {!commandDown && item.id === 'favorites' && libraryStats != null && (
                <span className="text-mac-small text-gray-400">{libraryStats.favoriteCount}</span>
              )}
              {commandDown && shortcut && (
                <span
                  className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none bg-gray-800/90 text-white dark:bg-gray-200/90 dark:text-gray-900 shadow-xs"
                  style={{ animation: 'shortcut-fade-in 100ms ease-out' }}
                >
                  {formatKeys(shortcut.keys)}
                </span>
              )}
            </button>
          );
        })}

        {/* Collections */}
        <div className="pt-4 pb-1 px-2 flex items-center justify-between">
          <span className="text-mac-small font-semibold text-gray-400 uppercase tracking-wider">Collections</span>
          <button
            onClick={() => setShowNewCollection(true)}
            className="no-drag text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none"
            title="New collection"
          >
            +
          </button>
        </div>
        {collections.length === 0 && <p className="px-2 text-mac-small text-gray-400">No collections yet</p>}
        {collections.map((col) => (
          <SidebarItem
            key={col.id}
            id={col.id}
            name={col.name}
            color={col.color}
            paperCount={col.paperCount}
            isSelected={sidebarView === 'collection' && selectedCollectionId === col.id}
            onClick={() => navigateToCollection(col.id)}
            onRename={(id, newName) => updateCollection(id, newName, col.color)}
            onEdit={(id) => setEditCollection({ id, name: col.name, color: col.color })}
            onDelete={handleDeleteCollection}
            itemType="collection"
            onDrop={async (paperId) => {
              await addPaperToCollection(paperId, col.id);
              toast(`Added to "${col.name}"`, 'success');
            }}
          />
        ))}

        {/* Tags */}
        <div className="pt-4 pb-1 px-2 flex items-center justify-between">
          <span className="text-mac-small font-semibold text-gray-400 uppercase tracking-wider">Tags</span>
          <button
            onClick={() => setShowNewTag(true)}
            className="no-drag text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none"
            title="New tag"
          >
            +
          </button>
        </div>
        {tags.length === 0 && <p className="px-2 text-mac-small text-gray-400">No tags yet</p>}
        {tags.map((tag) => (
          <SidebarItem
            key={tag.id}
            id={tag.id}
            name={tag.name}
            color={tag.color}
            paperCount={tag.paperCount}
            isSelected={sidebarView === 'tag' && selectedTagId === tag.id}
            onClick={() => navigateToTag(tag.id)}
            onRename={(id, newName) => updateTag(id, newName, tag.color)}
            onEdit={(id) => setEditTag({ id, name: tag.name, color: tag.color })}
            onDelete={handleDeleteTag}
            itemType="tag"
          />
        ))}
      </nav>

      {/* Footer bar */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => toggleMcpServer(mcpStatus.port)}
          disabled={mcpLoading}
          className={`no-drag flex items-center gap-1.5 text-mac-small transition-colors ${
            mcpLoading ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer'
          } text-gray-500 dark:text-gray-400`}
          title={mcpStatus.running ? 'Stop MCP server' : 'Start MCP server'}
        >
          <span className={`w-2 h-2 rounded-full ${mcpStatus.running ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span>MCP</span>
        </button>
        <ShortcutHint shortcutId="toggleSettings" position="above">
          <button
            onClick={() => setSidebarView('settings')}
            className={`no-drag flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer ${
              sidebarView === 'settings' ? 'text-gray-800 dark:text-gray-200' : ''
            }`}
            title="Settings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" />
              <path d="M13.3 10a1.1 1.1 0 00.2 1.2l.04.04a1.34 1.34 0 11-1.9 1.9l-.04-.04a1.1 1.1 0 00-1.2-.2 1.1 1.1 0 00-.67 1.01v.11a1.34 1.34 0 01-2.68 0v-.06a1.1 1.1 0 00-.72-1.01 1.1 1.1 0 00-1.2.2l-.04.04a1.34 1.34 0 11-1.9-1.9l.04-.04a1.1 1.1 0 00.2-1.2 1.1 1.1 0 00-1.01-.67h-.11a1.34 1.34 0 010-2.68h.06a1.1 1.1 0 001.01-.72 1.1 1.1 0 00-.2-1.2l-.04-.04a1.34 1.34 0 111.9-1.9l.04.04a1.1 1.1 0 001.2.2h.05a1.1 1.1 0 00.67-1.01v-.11a1.34 1.34 0 012.68 0v.06a1.1 1.1 0 00.67 1.01 1.1 1.1 0 001.2-.2l.04-.04a1.34 1.34 0 111.9 1.9l-.04.04a1.1 1.1 0 00-.2 1.2v.05a1.1 1.1 0 001.01.67h.11a1.34 1.34 0 010 2.68h-.06a1.1 1.1 0 00-1.01.67z" />
            </svg>
          </button>
        </ShortcutHint>
      </div>

      {showNewCollection && <CollectionManager onClose={() => setShowNewCollection(false)} />}
      {showNewTag && <TagManager onClose={() => setShowNewTag(false)} />}
      {editCollection && (
        <CollectionManager
          onClose={() => setEditCollection(null)}
          editId={editCollection.id}
          editName={editCollection.name}
          editColor={editCollection.color}
        />
      )}
      {editTag && (
        <TagManager
          onClose={() => setEditTag(null)}
          editId={editTag.id}
          editName={editTag.name}
          editColor={editTag.color}
        />
      )}
    </aside>
  );
}
