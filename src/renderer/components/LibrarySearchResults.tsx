import type { LibraryPaper } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { toast } from '../stores/toastStore';
import { PaperListItem } from './PaperListItem';

interface LibrarySearchResultsProps {
  results: LibraryPaper[];
  selectedPaperId: string | null;
  onSelectPaper: (paper: LibraryPaper) => void;
}

export function LibrarySearchResults({ results, selectedPaperId, onSelectPaper }: LibrarySearchResultsProps) {
  const { addTagToPaper, tags } = usePaperStore();

  if (results.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {results.map((paper) => (
        <PaperListItem
          key={paper.id}
          title={paper.title}
          authors={paper.authors}
          date={paper.publishedDate}
          categories={paper.categories}
          isSelected={selectedPaperId === paper.id}
          isFavorite={paper.isFavorite}
          onClick={() => onSelectPaper(paper)}
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
