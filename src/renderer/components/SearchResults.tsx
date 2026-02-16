import { useEffect } from 'react';
import type { ArxivPaper } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { useUIStore } from '../stores/uiStore';
import { PaperListItem } from './PaperListItem';
import { SaveToLibraryButton } from './SaveToLibraryButton';

interface SearchResultsProps {
  results: ArxivPaper[];
  selectedPaperId: string | null;
  onSelectPaper: (paper: ArxivPaper) => void;
}

export function SearchResults({ results, selectedPaperId, onSelectPaper }: SearchResultsProps) {
  const { libraryPaperIds, checkPapersInLibrary } = usePaperStore();
  const focusedPaperIndex = useUIStore((s) => s.focusedPaperIndex);

  // When results change: check library status, reset selection to first paper
  useEffect(() => {
    useUIStore.getState().setPaperListLength(results.length);
    useUIStore.getState().setFocusedPaperIndex(0);
    if (results.length > 0) {
      checkPapersInLibrary(results.map((p) => p.id));
      onSelectPaper(results[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, checkPapersInLibrary]);

  // When focusedPaperIndex changes (keyboard navigation): select paper and scroll
  useEffect(() => {
    if (results.length === 0) return;
    const clamped = Math.min(focusedPaperIndex, results.length - 1);
    const paper = results[clamped];
    if (paper && selectedPaperId !== paper.id) {
      onSelectPaper(paper);
    }
    document.querySelector(`[data-paper-index="${clamped}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focusedPaperIndex, results, selectedPaperId, onSelectPaper]);

  if (results.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {results.map((paper, index) => {
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
            onClick={() => {
              onSelectPaper(paper);
              useUIStore.getState().setFocusedPaperIndex(index);
              useUIStore.getState().setActivePanel('list');
            }}
            paperIndex={index}
            rightSlot={
              inLibrary ? undefined : <SaveToLibraryButton paper={paper} alreadySaved={false} isSelected={selectedPaperId === paper.id} />
            }
          />
        );
      })}
    </div>
  );
}
