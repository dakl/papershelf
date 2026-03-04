import { useCallback, useEffect, useState } from 'react';
import type { IndexingStats } from '../../shared/types';

export function IndexNewButton() {
  const [stats, setStats] = useState<IndexingStats | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const result = await window.electronAPI.getIndexingStats();
      setStats(result);
    } catch {
      // Vector store may not be available
    }
  }, []);

  useEffect(() => {
    refreshStats();

    const unsubIndex = window.electronAPI.onIndexingProgress((progress) => {
      if (progress.status === 'indexing') {
        setIsIndexing(true);
      } else if (progress.status === 'complete') {
        setIsIndexing(false);
        refreshStats();
      } else if (progress.status === 'indexed' || progress.status === 'error') {
        refreshStats();
      }
    });

    return unsubIndex;
  }, [refreshStats]);

  const handleClick = useCallback(async () => {
    setIsIndexing(true);
    await window.electronAPI.reindexAllPapers();
  }, []);

  const pending = (stats?.pending ?? 0) + (stats?.failed ?? 0);
  if (pending === 0 && !isIndexing) return null;

  return (
    <button
      onClick={handleClick}
      disabled={isIndexing}
      className={`text-mac-small px-1.5 py-0.5 rounded transition-colors ${
        isIndexing
          ? 'text-gray-400 dark:text-gray-500 cursor-default'
          : 'text-mac-accent hover:bg-mac-accent/10 cursor-pointer'
      }`}
      title={isIndexing ? 'Indexing in progress...' : `Index ${pending} new paper${pending !== 1 ? 's' : ''}`}
    >
      {isIndexing ? 'Indexing...' : `Index ${pending} new`}
    </button>
  );
}
