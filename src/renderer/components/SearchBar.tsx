import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchMode } from '../hooks/useSearch';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

export function SearchBar({ onSearch, loading, mode, onModeChange }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch(query);
    },
    [query, onSearch],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 p-0.5 bg-black/5 dark:bg-white/10 rounded-md">
        <button
          onClick={() => onModeChange('arxiv')}
          className={`flex-1 px-2 py-1 rounded text-mac-small font-medium transition-colors ${
            mode === 'arxiv' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          arXiv
        </button>
        <button
          onClick={() => onModeChange('library')}
          className={`flex-1 px-2 py-1 rounded text-mac-small font-medium transition-colors ${
            mode === 'library' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Library
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'arxiv' ? 'Search arXiv papers... (⌘K)' : 'Search your library... (⌘K)'}
            className="w-full px-3 py-1.5 rounded-md bg-black/5 dark:bg-white/10 border border-mac-separator text-mac-body placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
          />
          {loading && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-mac-accent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-3 py-1.5 rounded-md bg-mac-accent text-white text-mac-body font-medium disabled:opacity-50 hover:bg-blue-600 transition-colors"
        >
          Search
        </button>
      </form>
    </div>
  );
}
