import { useEffect, useState } from 'react';
import type { PaperFilter } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { toast } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import { PaperListItem } from './PaperListItem';

export function LibraryList() {
  const { sidebarView, selectedCollectionId, selectedTagId, sortBy, sortOrder } = useUIStore();
  const { papers, selectedLibraryPaper, setSelectedLibraryPaper, loadPapers, loading, addTagToPaper, tags } =
    usePaperStore();
  const [activelyIndexingPaperId, setActivelyIndexingPaperId] = useState<string | null>(null);
  const [indexingActive, setIndexingActive] = useState(false);

  useEffect(() => {
    const filter: PaperFilter = { view: sidebarView as PaperFilter['view'], sortBy, sortOrder };
    if (sidebarView === 'collection' && selectedCollectionId) {
      filter.collectionId = selectedCollectionId;
    }
    if (sidebarView === 'tag' && selectedTagId) {
      filter.tagId = selectedTagId;
    }
    loadPapers(filter);

    const unsubPapers = window.electronAPI.onPapersChanged(() => {
      loadPapers(filter);
    });
    const unsubIndexing = window.electronAPI.onIndexingProgress((progress) => {
      if (progress.status === 'indexing') {
        setActivelyIndexingPaperId(progress.paperId);
        setIndexingActive(true);
      } else if (progress.status === 'complete') {
        setActivelyIndexingPaperId(null);
        setIndexingActive(false);
      } else {
        setActivelyIndexingPaperId(null);
      }
      loadPapers(filter);
    });
    return () => {
      unsubPapers();
      unsubIndexing();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarView, selectedCollectionId, selectedTagId, sortBy, sortOrder, loadPapers]);

  const focusedPaperIndex = useUIStore((s) => s.focusedPaperIndex);

  useEffect(() => {
    useUIStore.getState().setPaperListLength(papers.length);
  }, [papers.length]);

  useEffect(() => {
    if (papers.length > 0 && !selectedLibraryPaper) {
      setSelectedLibraryPaper(papers[0]);
      useUIStore.getState().setFocusedPaperIndex(0);
    }
  }, [papers, selectedLibraryPaper, setSelectedLibraryPaper]);

  useEffect(() => {
    if (papers.length === 0) return;
    const clamped = Math.min(focusedPaperIndex, papers.length - 1);
    const paper = papers[clamped];
    if (paper && selectedLibraryPaper?.id !== paper.id) {
      setSelectedLibraryPaper(paper);
    }
    document.querySelector(`[data-paper-index="${clamped}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focusedPaperIndex, papers, selectedLibraryPaper, setSelectedLibraryPaper]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-mac-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-mac-body px-6 text-center">
        No papers yet. Search arXiv and save papers to your library.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {papers.map((paper, index) => (
        <PaperListItem
          key={paper.id}
          title={paper.title}
          authors={paper.authors}
          date={paper.publishedDate}
          categories={paper.categories}
          isSelected={selectedLibraryPaper?.id === paper.id}
          isFavorite={paper.isFavorite}
          embeddingStatus={paper.embeddingStatus}
          isActivelyIndexing={paper.id === activelyIndexingPaperId}
          isQueuedForIndexing={
            indexingActive && paper.embeddingStatus !== 'complete' && paper.id !== activelyIndexingPaperId
          }
          onClick={() => {
            setSelectedLibraryPaper(paper);
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
