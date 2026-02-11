import { useEffect, useState } from 'react';
import type { Collection, LibraryPaper, Tag } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { useUIStore } from '../stores/uiStore';
import { PdfViewer } from './PdfViewer';

type DetailTab = 'pdf' | 'abstract';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function PaperDetail() {
  const { sidebarView, selectedPaper } = useUIStore();
  const {
    selectedLibraryPaper,
    toggleFavorite,
    collections,
    tags,
    addPaperToCollection,
    removePaperFromCollection,
    addTagToPaper,
    removeTagFromPaper,
  } = usePaperStore();
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('abstract');

  const isLibraryView = sidebarView !== 'search';
  const paper = isLibraryView ? selectedLibraryPaper : selectedPaper;

  const isLibraryPaper = paper ? 'isFavorite' in paper : false;
  const hasPdf = isLibraryPaper && (paper as LibraryPaper).pdfPath != null;
  const paperIdentity = paper ? ('arxivId' in paper ? (paper as LibraryPaper).id : paper.id) : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset all state on paper change
  useEffect(() => {
    setShowCollectionPicker(false);
    setShowTagPicker(false);
    setActiveTab(hasPdf ? 'pdf' : 'abstract');
  }, [paperIdentity, hasPdf]);

  if (!paper) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white/40 dark:bg-black/20">
        <p className="text-gray-400 text-mac-body">Select a paper to view details</p>
      </div>
    );
  }

  const paperCollections: Collection[] = isLibraryPaper ? (paper as { collections: Collection[] }).collections : [];
  const paperTags: Tag[] = isLibraryPaper ? (paper as { tags: Tag[] }).tags : [];
  const paperId = isLibraryPaper ? (paper as { id: string }).id : null;

  const handleToggleFavorite = () => {
    if (paperId) toggleFavorite(paperId);
  };

  const handleToggleCollection = async (collectionId: string) => {
    if (!paperId) return;
    const isInCollection = paperCollections.some((c) => c.id === collectionId);
    if (isInCollection) {
      await removePaperFromCollection(paperId, collectionId);
    } else {
      await addPaperToCollection(paperId, collectionId);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!paperId) return;
    const hasTag = paperTags.some((t) => t.id === tagId);
    if (hasTag) {
      await removeTagFromPaper(paperId, tagId);
    } else {
      await addTagToPaper(paperId, tagId);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white/40 dark:bg-black/20 overflow-hidden">
      <div className="drag-region h-[38px] flex-shrink-0" />

      <div className="flex-shrink-0 px-6">
        <div className="flex items-start gap-2">
          <h1 className="flex-1 text-mac-heading font-semibold leading-snug">{paper.title}</h1>
          {isLibraryPaper && (
            <button
              onClick={handleToggleFavorite}
              className="no-drag flex-shrink-0 text-lg mt-0.5 hover:scale-110 transition-transform"
              title={(paper as { isFavorite: boolean }).isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {(paper as { isFavorite: boolean }).isFavorite ? '⭐' : '☆'}
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {paper.authors.map((author) => (
            <span key={author} className="text-mac-small text-mac-accent">
              {author}
            </span>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 text-mac-small text-gray-500">
          <span>{formatDate(paper.publishedDate)}</span>
          <span>
            arXiv: {'arxivId' in paper ? (paper as { arxivId: string }).arxivId : (paper as { id: string }).id}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {paper.categories.map((cat) => (
            <span
              key={cat}
              className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Collection + tag chips for library papers */}
        {isLibraryPaper && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {paperCollections.map((col) => (
              <span
                key={col.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                {col.name}
              </span>
            ))}
            {paperTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}

            {/* Pickers */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowCollectionPicker(!showCollectionPicker);
                  setShowTagPicker(false);
                }}
                className="no-drag px-1.5 py-0.5 rounded text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                + Collection
              </button>
              {showCollectionPicker && collections.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-mac-separator z-10 py-1">
                  {collections.map((col) => {
                    const isIn = paperCollections.some((c) => c.id === col.id);
                    return (
                      <button
                        key={col.id}
                        onClick={() => handleToggleCollection(col.id)}
                        className="w-full text-left px-3 py-1.5 text-mac-small hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                        <span className="flex-1">{col.name}</span>
                        {isIn && <span className="text-mac-accent">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowTagPicker(!showTagPicker);
                  setShowCollectionPicker(false);
                }}
                className="no-drag px-1.5 py-0.5 rounded text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                + Tag
              </button>
              {showTagPicker && tags.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-mac-separator z-10 py-1">
                  {tags.map((tag) => {
                    const has = paperTags.some((t) => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.id)}
                        className="w-full text-left px-3 py-1.5 text-mac-small hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1">{tag.name}</span>
                        {has && <span className="text-mac-accent">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <a
            href={paper.arxivUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-drag px-3 py-1 rounded-md text-mac-small font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Open on arXiv
          </a>
          {isLibraryPaper && (
            <button
              onClick={() => {
                const arxivId = 'arxivId' in paper ? (paper as { arxivId: string }).arxivId : '';
                if (arxivId) useUIStore.getState().navigateToCitations([arxivId]);
              }}
              className="no-drag px-3 py-1 rounded-md text-mac-small font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Explore Citations
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-4 border-b border-mac-separator">
          {hasPdf && (
            <button
              onClick={() => setActiveTab('pdf')}
              className={`no-drag pb-2 text-mac-small font-medium transition-colors ${
                activeTab === 'pdf'
                  ? 'border-b-2 border-mac-accent text-mac-accent'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              PDF
            </button>
          )}
          <button
            onClick={() => setActiveTab('abstract')}
            className={`no-drag pb-2 text-mac-small font-medium transition-colors ${
              activeTab === 'abstract'
                ? 'border-b-2 border-mac-accent text-mac-accent'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Abstract
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'pdf' && paperId ? (
          <PdfViewer paperId={paperId} />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="mt-4">
              <p className="text-mac-body leading-relaxed text-gray-700 dark:text-gray-300 select-text">
                {paper.abstract}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
