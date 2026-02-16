import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../stores/uiStore';
import { ConfirmPopup } from './ConfirmPopup';
import type { ContextMenuItem } from './ContextMenu';
import { ContextMenu } from './ContextMenu';
import { PencilIcon, TrashIcon } from './Icons';

interface SidebarItemProps {
  id: string;
  name: string;
  color: string;
  paperCount: number;
  isSelected: boolean;
  onClick: () => void;
  onRename: (id: string, newName: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  itemType: 'collection' | 'tag';
  onDrop?: (dataValue: string) => void;
}

export function SidebarItem({
  id,
  name,
  color,
  paperCount,
  isSelected,
  onClick,
  onRename,
  onEdit,
  onDelete,
  itemType,
  onDrop,
}: SidebarItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const startRename = () => {
    setRenameValue(name);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(id, trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setRenameValue(name);
    setIsRenaming(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setConfirmDelete({ x: rect.left, y: rect.bottom + 4 });
  };

  const activePanel = useUIStore((s) => s.activePanel);
  const isCollection = itemType === 'collection';
  const isTag = itemType === 'tag';
  const acceptedDragType = isCollection ? 'application/x-paper-id' : null;

  const handleDragStart = (e: React.DragEvent) => {
    if (!isTag) return;
    e.dataTransfer.setData('application/x-tag-id', id);
    e.dataTransfer.effectAllowed = 'link';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!acceptedDragType || !onDrop || !e.dataTransfer.types.includes(acceptedDragType)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    setDragOver(false);
    if (!acceptedDragType || !onDrop) return;
    const value = e.dataTransfer.getData(acceptedDragType);
    if (value) onDrop(value);
  };

  const contextMenuItems: ContextMenuItem[] = [
    { label: 'Rename', onClick: startRename },
    { label: 'Change Color\u2026', onClick: () => onEdit(id) },
    {
      label: 'Delete',
      onClick: () => setConfirmDelete({ x: contextMenu?.x ?? 0, y: contextMenu?.y ?? 0 }),
      variant: 'danger',
    },
  ];

  return (
    <>
      <div
        className={`group no-drag w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mac-body text-left transition-colors cursor-default ${
          isSelected
            ? activePanel === 'sidebar'
              ? 'bg-mac-selection font-medium'
              : 'bg-mac-selection-inactive font-medium'
            : 'hover:bg-black/5 dark:hover:bg-white/5'
        } ${dragOver ? 'ring-2 ring-mac-accent ring-inset' : ''}`}
        onClick={isRenaming ? undefined : onClick}
        onContextMenu={handleContextMenu}
        draggable={isTag && !isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />

        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') cancelRename();
            }}
            onBlur={commitRename}
            className="flex-1 min-w-0 bg-transparent text-mac-body outline-none border-b border-mac-accent/40 py-0"
          />
        ) : (
          <span
            className="flex-1 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            {name}
          </span>
        )}

        {!isRenaming && (
          <>
            <span className="text-mac-small text-gray-400 group-hover:hidden">{paperCount}</span>
            <span className="hidden group-hover:flex items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(id);
                }}
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title={`Edit ${itemType}`}
              >
                <PencilIcon className="w-3 h-3" />
              </button>
              <button
                onClick={handleDeleteClick}
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-gray-400 hover:text-red-500"
                title={`Delete ${itemType}`}
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </span>
          </>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmPopup
          x={confirmDelete.x}
          y={confirmDelete.y}
          message={`Delete ${itemType} "${name}"?`}
          onConfirm={() => {
            onDelete(id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
