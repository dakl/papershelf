import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SIDEBAR_TRANSITION_MS, SIDEBAR_WIDTH } from '../constants';
import { usePaperStore } from '../stores/paperStore';
import { formatKeys, useShortcutStore } from '../stores/shortcutStore';
import { toast } from '../stores/toastStore';
import { type SidebarView, useUIStore } from '../stores/uiStore';
import { CollectionManager } from './CollectionManager';
import { ClockIcon, DocTextIcon, SearchIcon, StarIcon } from './Icons';
import { SidebarItem } from './SidebarItem';
import { TagManager } from './TagManager';

type SidebarNavigableItem =
  | { type: 'nav'; id: SidebarView; label: string }
  | { type: 'collection'; id: string; name: string }
  | { type: 'tag'; id: string; name: string };

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
    activePanel,
    sidebarFocusIndex,
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
  const commandDown = useShortcutStore((s) => s.commandDown);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [editCollection, setEditCollection] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editTag, setEditTag] = useState<{ id: string; name: string; color: string } | null>(null);

  const flatItems = useMemo<SidebarNavigableItem[]>(() => {
    const items: SidebarNavigableItem[] = NAV_ITEMS.map((item) => ({
      type: 'nav' as const,
      id: item.id,
      label: item.label,
    }));
    for (const col of collections) {
      items.push({ type: 'collection', id: col.id, name: col.name });
    }
    for (const tag of tags) {
      items.push({ type: 'tag', id: tag.id, name: tag.name });
    }
    return items;
  }, [collections, tags]);

  useEffect(() => {
    useUIStore.getState().setSidebarItemCount(flatItems.length);
  }, [flatItems.length]);

  useEffect(() => {
    if (activePanel !== 'sidebar') return;
    const item = flatItems[sidebarFocusIndex];
    if (!item) return;
    if (item.type === 'nav') {
      const ui = useUIStore.getState();
      if (ui.sidebarView !== item.id) setSidebarView(item.id);
    } else if (item.type === 'collection') {
      navigateToCollection(item.id);
    } else if (item.type === 'tag') {
      navigateToTag(item.id);
    }
    // setSidebarView/navigateToCollection/navigateToTag reset activePanel to 'list',
    // but we want to stay in the sidebar during keyboard navigation
    useUIStore.getState().setActivePanel('sidebar');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarFocusIndex, activePanel, flatItems, setSidebarView, navigateToCollection, navigateToTag]);

  // Create refs for stable store functions to avoid dependency issues
  const loadCollectionsRef = useRef(loadCollections);
  const loadTagsRef = useRef(loadTags);
  const loadLibraryStatsRef = useRef(loadLibraryStats);

  // Initial data load (events will handle subsequent updates)
  useEffect(() => {
    loadCollectionsRef.current();
    loadTagsRef.current();
    loadLibraryStatsRef.current();

    // Set up event listeners for real-time updates
    const collectionsUnsubscribe = window.electronAPI.onCollectionsChanged(() => {
      loadCollectionsRef.current();
    });

    const tagsUnsubscribe = window.electronAPI.onTagsChanged(() => {
      loadTagsRef.current();
    });

    return () => {
      collectionsUnsubscribe();
      tagsUnsubscribe();
    };
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

  const findFlatIndex = (type: string, id: string) =>
    flatItems.findIndex((item) => item.type === type && item.id === id);

  const handleNavClick = (itemId: SidebarView) => {
    setSidebarView(itemId);
    const idx = findFlatIndex('nav', itemId);
    if (idx >= 0) useUIStore.getState().setSidebarFocusIndex(idx);
    useUIStore.getState().setActivePanel('sidebar');
  };

  const handleCollectionClick = (colId: string) => {
    navigateToCollection(colId);
    const idx = findFlatIndex('collection', colId);
    if (idx >= 0) useUIStore.getState().setSidebarFocusIndex(idx);
    useUIStore.getState().setActivePanel('sidebar');
  };

  const handleTagClick = (tagId: string) => {
    navigateToTag(tagId);
    const idx = findFlatIndex('tag', tagId);
    if (idx >= 0) useUIStore.getState().setSidebarFocusIndex(idx);
    useUIStore.getState().setActivePanel('sidebar');
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
          const isActive = sidebarView === item.id;
          const selectionClass = isActive
            ? activePanel === 'sidebar'
              ? 'bg-mac-selection font-medium'
              : 'bg-mac-selection-inactive font-medium'
            : 'hover:bg-black/5 dark:hover:bg-white/5';
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`no-drag w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mac-body text-left transition-colors ${selectionClass}`}
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
            onClick={() => handleCollectionClick(col.id)}
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
            onClick={() => handleTagClick(tag.id)}
            onRename={(id, newName) => updateTag(id, newName, tag.color)}
            onEdit={(id) => setEditTag({ id, name: tag.name, color: tag.color })}
            onDelete={handleDeleteTag}
            itemType="tag"
          />
        ))}
      </nav>

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
