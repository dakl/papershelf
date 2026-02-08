import { useEffect, useState } from 'react';
import { useUIStore, type SidebarView } from '../stores/uiStore';
import { usePaperStore } from '../stores/paperStore';
import { CollectionManager } from './CollectionManager';
import { TagManager } from './TagManager';

const NAV_ITEMS: { id: SidebarView; label: string; icon: string }[] = [
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'all-papers', label: 'All Papers', icon: '📄' },
  { id: 'favorites', label: 'Favorites', icon: '⭐' },
  { id: 'recent', label: 'Recently Added', icon: '🕐' },
];

export function Sidebar() {
  const { sidebarView, setSidebarView, navigateToCollection, navigateToTag, selectedCollectionId, selectedTagId } = useUIStore();
  const { collections, tags, loadCollections, loadTags, deleteCollection, deleteTag } = usePaperStore();
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);

  useEffect(() => {
    loadCollections();
    loadTags();
  }, [loadCollections, loadTags]);

  return (
    <aside className="w-[220px] flex-shrink-0 border-r sidebar-separator flex flex-col bg-transparent">
      <div className="drag-region h-[38px] flex-shrink-0" />

      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setSidebarView(item.id)}
            className={`no-drag w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mac-body text-left transition-colors ${
              sidebarView === item.id
                ? 'bg-mac-selection font-medium'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="text-sm">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        {/* Collections */}
        <div className="pt-4 pb-1 px-2 flex items-center justify-between">
          <span className="text-mac-small font-semibold text-gray-400 uppercase tracking-wider">
            Collections
          </span>
          <button
            onClick={() => setShowNewCollection(true)}
            className="no-drag text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none"
            title="New collection"
          >
            +
          </button>
        </div>
        {collections.length === 0 && (
          <p className="px-2 text-mac-small text-gray-400">No collections yet</p>
        )}
        {collections.map((col) => (
          <button
            key={col.id}
            onClick={() => navigateToCollection(col.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`Delete collection "${col.name}"?`)) {
                deleteCollection(col.id);
              }
            }}
            className={`no-drag w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mac-body text-left transition-colors ${
              sidebarView === 'collection' && selectedCollectionId === col.id
                ? 'bg-mac-selection font-medium'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
            <span className="flex-1 truncate">{col.name}</span>
            <span className="text-mac-small text-gray-400">{col.paperCount}</span>
          </button>
        ))}

        {/* Tags */}
        <div className="pt-4 pb-1 px-2 flex items-center justify-between">
          <span className="text-mac-small font-semibold text-gray-400 uppercase tracking-wider">
            Tags
          </span>
          <button
            onClick={() => setShowNewTag(true)}
            className="no-drag text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none"
            title="New tag"
          >
            +
          </button>
        </div>
        {tags.length === 0 && (
          <p className="px-2 text-mac-small text-gray-400">No tags yet</p>
        )}
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => navigateToTag(tag.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`Delete tag "${tag.name}"?`)) {
                deleteTag(tag.id);
              }
            }}
            className={`no-drag w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mac-body text-left transition-colors ${
              sidebarView === 'tag' && selectedTagId === tag.id
                ? 'bg-mac-selection font-medium'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
            <span className="flex-1 truncate">{tag.name}</span>
            <span className="text-mac-small text-gray-400">{tag.paperCount}</span>
          </button>
        ))}
      </nav>

      {showNewCollection && <CollectionManager onClose={() => setShowNewCollection(false)} />}
      {showNewTag && <TagManager onClose={() => setShowNewTag(false)} />}
    </aside>
  );
}
