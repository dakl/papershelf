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
}: PaperListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-mac-separator transition-colors ${
        isSelected
          ? 'bg-mac-selection'
          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-mac-body font-medium leading-snug line-clamp-2">
            {isFavorite && <span className="mr-1">⭐</span>}
            {title}
          </h3>
          <p className="text-mac-small text-gray-500 mt-0.5">
            {truncateAuthors(authors)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-mac-small text-gray-400">
              {formatDate(date)}
            </span>
            {inLibrary && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                In Library
              </span>
            )}
            <div className="flex gap-1">
              {categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>
        {rightSlot && <div className="flex-shrink-0 mt-0.5">{rightSlot}</div>}
      </div>
    </button>
  );
}
