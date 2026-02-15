import { useEffect } from 'react';
import type { PaperFilter } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { toast } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import { PaperListItem } from './PaperListItem';

export function LibraryList() {
  const { sidebarView, selectedCollectionId, selectedTagId, sortBy, sortOrder } = useUIStore();
  const { papers, selectedLibraryPaper, setSelectedLibraryPaper, loadPapers, loading, addTagToPaper, tags } =
    usePaperStore();

  useEffect(() => {
    const filter: PaperFilter = { view: sidebarView as PaperFilter['view'], sortBy, sortOrder };
    if (sidebarView === 'collection' && selectedCollectionId) {
      filter.collectionId = selectedCollectionId;
    }
    if (sidebarView === 'tag' && selectedTagId) {
      filter.tagId = selectedTagId;
    }
    loadPapers(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarView, selectedCollectionId, selectedTagId, sortBy, sortOrder, loadPapers]);

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
      {papers.map((paper) => (
        <PaperListItem
          key={paper.id}
          title={paper.title}
          authors={paper.authors}
          date={paper.publishedDate}
          categories={paper.categories}
          isSelected={selectedLibraryPaper?.id === paper.id}
          isFavorite={paper.isFavorite}
          onClick={() => setSelectedLibraryPaper(paper)}
          paperId={paper.id}
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
