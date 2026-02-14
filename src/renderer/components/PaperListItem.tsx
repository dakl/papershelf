import { useState } from 'react';
import { StarIcon } from './Icons';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateAuthors(authors: string[], max = 3): string {
  if (authors.length <= max) return authors.join(', ');
  return `${authors.slice(0, max).join(', ')} +${authors.length - max}`;
}

interface PaperListItemProps {
  title: string;
  authors: string[];
  date: string;
  categories: string[];
  isSelected: boolean;
  isFavorite?: boolean;
  inLibrary?: boolean;
  onClick: () => void;
  rightSlot?: React.ReactNode;
  paperId?: string;
  onTagDrop?: (tagId: string) => void;
}

export function PaperListItem({
  title,
  authors,
  date,
  categories,
  isSelected,
  isFavorite,
  inLibrary,
  onClick,
  rightSlot,
  paperId,
  onTagDrop,
}: PaperListItemProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    if (!paperId) return;
    e.dataTransfer.setData('application/x-paper-id', paperId);
    e.dataTransfer.effectAllowed = 'link';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!onTagDrop || !e.dataTransfer.types.includes('application/x-tag-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    setDragOver(false);
    const tagId = e.dataTransfer.getData('application/x-tag-id');
    if (tagId && onTagDrop) onTagDrop(tagId);
  };

  return (
    <button
      onClick={onClick}
      draggable={!!paperId}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full text-left px-3 py-2.5 border-b border-mac-separator transition-colors ${
        isSelected ? 'bg-mac-selection' : 'hover:bg-black/3 dark:hover:bg-white/3'
      } ${dragOver ? 'ring-2 ring-mac-accent ring-inset' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-mac-body font-medium leading-snug line-clamp-2">
            {isFavorite && (
              <StarIcon className="inline-block mr-1 text-yellow-500 align-text-top" width={14} height={14} />
            )}
            {title}
          </h3>
          <p className="text-mac-small text-gray-500 mt-0.5">{truncateAuthors(authors)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-mac-small text-gray-400">{formatDate(date)}</span>
            {inLibrary && (
              <span className="px-1.5 py-0.5 rounded-sm text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                In Library
              </span>
            )}
            <div className="flex gap-1">
              {categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-1.5 py-0.5 rounded-sm text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>
        {rightSlot && <div className="shrink-0 mt-0.5">{rightSlot}</div>}
      </div>
    </button>
  );
}
