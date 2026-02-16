import { useEffect } from 'react';
import type { ArxivPaper } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { PaperListItem } from './PaperListItem';
import { SaveToLibraryButton } from './SaveToLibraryButton';

interface SearchResultsProps {
  results: ArxivPaper[];
  selectedPaperId: string | null;
  onSelectPaper: (paper: ArxivPaper) => void;
}

export function SearchResults({ results, selectedPaperId, onSelectPaper }: SearchResultsProps) {
  const { libraryPaperIds, checkPapersInLibrary } = usePaperStore();

  useEffect(() => {
    if (results.length > 0) {
      checkPapersInLibrary(results.map((p) => p.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, checkPapersInLibrary]);

  if (results.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {results.map((paper) => {
        const inLibrary = libraryPaperIds.has(paper.id);
        return (
          <PaperListItem
            key={paper.id}
            title={paper.title}
            authors={paper.authors}
            date={paper.publishedDate}
            categories={paper.categories}
            isSelected={selectedPaperId === paper.id}
            inLibrary={inLibrary}
            onClick={() => onSelectPaper(paper)}
            rightSlot={<SaveToLibraryButton paper={paper} alreadySaved={inLibrary} />}
          />
        );
      })}
    </div>
  );
}
