import type { SortBy, SortOrder } from '../../shared/types';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'created_at', label: 'Date Added' },
  { value: 'published_date', label: 'Published' },
  { value: 'title', label: 'Title' },
  { value: 'first_author', label: 'Author' },
];

interface SortControlProps {
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortByChange: (sortBy: SortBy) => void;
  onToggleSortOrder: () => void;
}

export function SortControl({ sortBy, sortOrder, onSortByChange, onToggleSortOrder }: SortControlProps) {
  return (
    <div className="flex items-center gap-1">
      <select
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as SortBy)}
        className="text-mac-small bg-transparent border-none outline-none cursor-pointer
                   text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300
                   py-0.5 pr-1"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onToggleSortOrder}
        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={sortOrder === 'asc' ? 'rotate-180' : ''}
        >
          <path d="M6 2v8M3 7l3 3 3-3" />
        </svg>
      </button>
    </div>
  );
}
