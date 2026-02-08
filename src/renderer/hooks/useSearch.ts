import { useState, useCallback } from 'react';
import type { ArxivPaper, LibraryPaper } from '../../shared/types';

export type SearchMode = 'arxiv' | 'library';

interface SearchState {
  results: ArxivPaper[];
  libraryResults: LibraryPaper[];
  loading: boolean;
  error: string | null;
  query: string;
  mode: SearchMode;
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    results: [],
    libraryResults: [],
    loading: false,
    error: null,
    query: '',
    mode: 'arxiv',
  });

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setState((prev) => ({ ...prev, loading: true, error: null, query }));

    try {
      if (state.mode === 'arxiv') {
        const results = await window.electronAPI.searchArxiv(query);
        setState((prev) => ({ ...prev, results, libraryResults: [], loading: false }));
      } else {
        const libraryResults = await window.electronAPI.searchLibrary(query);
        setState((prev) => ({ ...prev, libraryResults, results: [], loading: false }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Search failed',
      }));
    }
  }, [state.mode]);

  const setMode = useCallback((mode: SearchMode) => {
    setState((prev) => ({
      ...prev,
      mode,
      results: [],
      libraryResults: [],
      error: null,
    }));
  }, []);

  const clear = useCallback(() => {
    setState({ results: [], libraryResults: [], loading: false, error: null, query: '', mode: state.mode });
  }, [state.mode]);

  return { ...state, search, clear, setMode };
}
