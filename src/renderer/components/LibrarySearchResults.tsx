import { useEffect } from 'react';
import type { LibraryPaper } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { toast } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import { PaperListItem } from './PaperListItem';

interface LibrarySearchResultsProps {
  results: LibraryPaper[];
  selectedPaperId: string | null;
  onSelectPaper: (paper: LibraryPaper) => void;
}

export function LibrarySearchResults({ results, selectedPaperId, onSelectPaper }: LibrarySearchResultsProps) {
  const { addTagToPaper, tags } = usePaperStore();
  const focusedPaperIndex = useUIStore((s) => s.focusedPaperIndex);

  // When results change: reset selection to first paper
  useEffect(() => {
    useUIStore.getState().setPaperListLength(results.length);
    useUIStore.getState().setFocusedPaperIndex(0);
    if (results.length > 0) {
      onSelectPaper(results[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

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
      {results.map((paper, index) => (
        <PaperListItem
          key={paper.id}
          title={paper.title}
          authors={paper.authors}
          date={paper.publishedDate}
          categories={paper.categories}
          isSelected={selectedPaperId === paper.id}
          isFavorite={paper.isFavorite}
          onClick={() => {
            onSelectPaper(paper);
            useUIStore.getState().setFocusedPaperIndex(index);
            useUIStore.getState().setActivePanel('list');
          }}
          paperId={paper.id}
          paperIndex={index}
          onTagDrop={async (tagId) => {
            await addTagToPaper(paper.id, tagId);
            const tagName = tags.find((t) => t.id === tagId)?.name;
            toast(tagName ? `Tagged with "${tagName}"` : 'Tag added', 'success');
          }}
        />
      ))}
    </div>
  );
}
