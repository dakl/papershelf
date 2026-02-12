import { useSearch } from '../hooks/useSearch';
import { usePaperStore } from '../stores/paperStore';
import { useUIStore } from '../stores/uiStore';
import { LibraryList } from './LibraryList';
import { LibrarySearchResults } from './LibrarySearchResults';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';

function getViewTitle(
  view: string,
  collections: { id: string; name: string }[],
  tags: { id: string; name: string }[],
  collectionId: string | null,
  tagId: string | null,
): string {
  switch (view) {
    case 'collection': {
      const col = collections.find((c) => c.id === collectionId);
      return col?.name ?? 'Collection';
    }
    case 'tag': {
      const tag = tags.find((t) => t.id === tagId);
      return tag?.name ?? 'Tag';
    }
    default:
      return view.replace(/-/g, ' ');
  }
}

export function PaperList({ width }: { width: number }) {
  const { sidebarView, selectedPaper, setSelectedPaper, selectedCollectionId, selectedTagId } = useUIStore();
  const { collections, tags, selectedLibraryPaper, setSelectedLibraryPaper } = usePaperStore();
  const { results, libraryResults, loading, error, search, mode, setMode } = useSearch();
  const isSearch = sidebarView === 'search';

  return (
    <div
      className="flex-shrink-0 border-r sidebar-separator flex flex-col bg-white/60 dark:bg-black/30"
      style={{ width }}
    >
      <div className="flex-shrink-0 px-3 pt-2 pb-2">
        {isSearch && (
          <div className="no-drag">
            <SearchBar onSearch={search} loading={loading} mode={mode} onModeChange={setMode} />
          </div>
        )}
        {!isSearch && (
          <h2 className="no-drag text-mac-heading font-semibold capitalize">
            {getViewTitle(sidebarView, collections, tags, selectedCollectionId, selectedTagId)}
          </h2>
        )}
      </div>

      {error && <div className="px-3 py-2 text-mac-small text-red-500">{error}</div>}

      {isSearch && mode === 'arxiv' && results.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-mac-body px-6 text-center">
          Search for papers on arXiv to get started
        </div>
      )}

      {isSearch && mode === 'library' && libraryResults.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-mac-body px-6 text-center">
          Search your saved papers by title, abstract, or full text
        </div>
      )}

      {isSearch && mode === 'arxiv' && (
        <SearchResults results={results} selectedPaperId={selectedPaper?.id ?? null} onSelectPaper={setSelectedPaper} />
      )}

      {isSearch && mode === 'library' && libraryResults.length > 0 && (
        <LibrarySearchResults
          results={libraryResults}
          selectedPaperId={selectedLibraryPaper?.id ?? null}
          onSelectPaper={setSelectedLibraryPaper}
        />
      )}

      {!isSearch && <LibraryList />}
    </div>
  );
}
