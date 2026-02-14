import { useCallback, useEffect, useRef, useState } from 'react';
import type { Collection, LibraryPaper, Tag } from '../../shared/types';
import { usePaperStore } from '../stores/paperStore';
import { formatKeys, useShortcutStore } from '../stores/shortcutStore';
import { useUIStore } from '../stores/uiStore';
import { PdfViewer } from './PdfViewer';

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
  const [showInfoPopover, setShowInfoPopover] = useState(false);
  const toggleFavoriteShortcut = useShortcutStore((state) => state.getShortcut('toggleFavorite'));
  const favoriteHint = toggleFavoriteShortcut ? ` (${formatKeys(toggleFavoriteShortcut.keys)})` : '';

  const isLibraryView = sidebarView !== 'search';
  const paper = isLibraryView ? selectedLibraryPaper : selectedPaper;

  const isLibraryPaper = paper ? 'isFavorite' in paper : false;
  const hasLocalPdf = isLibraryPaper && (paper as LibraryPaper).pdfPath != null;
  const hasPdfUrl = !isLibraryPaper && paper?.pdfUrl != null;
  const hasPdf = hasLocalPdf || hasPdfUrl;
  const paperIdentity = paper ? ('arxivId' in paper ? (paper as LibraryPaper).id : paper.id) : null;

  const closeInfoPopover = useCallback(() => {
    setShowInfoPopover(false);
    setShowCollectionPicker(false);
    setShowTagPicker(false);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset all state on paper change
  useEffect(() => {
    setShowCollectionPicker(false);
    setShowTagPicker(false);
    setShowInfoPopover(false);
  }, [paperIdentity]);

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
      {/* Compact header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-mac-separator">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="flex-1 text-mac-body font-semibold truncate min-w-0">{paper.title}</h1>

          {isLibraryPaper && (
            <button
              onClick={handleToggleFavorite}
              className="no-drag flex-shrink-0 text-sm hover:scale-110 transition-transform"
              title={`${(paper as { isFavorite: boolean }).isFavorite ? 'Remove from favorites' : 'Add to favorites'}${favoriteHint}`}
            >
              {(paper as { isFavorite: boolean }).isFavorite ? '⭐' : '☆'}
            </button>
          )}

          <InfoPopoverButton
            open={showInfoPopover}
            onToggle={() => setShowInfoPopover((v) => !v)}
            onClose={closeInfoPopover}
            paper={paper}
            isLibraryPaper={isLibraryPaper}
            paperCollections={paperCollections}
            paperTags={paperTags}
            collections={collections}
            tags={tags}
            showCollectionPicker={showCollectionPicker}
            setShowCollectionPicker={setShowCollectionPicker}
            showTagPicker={showTagPicker}
            setShowTagPicker={setShowTagPicker}
            handleToggleCollection={handleToggleCollection}
            handleToggleTag={handleToggleTag}
          />
        </div>

        <p className="text-mac-small text-gray-500 truncate mt-0.5">{paper.authors.join(', ')}</p>
      </div>

      {/* Content: always PDF */}
      <div className="flex-1 min-h-0 flex flex-col">
        {hasPdf ? (
          <PdfViewer
            paperId={paperId ?? undefined}
            pdfUrl={hasPdfUrl ? paper.pdfUrl : undefined}
            arxivId={hasPdfUrl ? paper.id : undefined}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-mac-body">No PDF available</div>
        )}
      </div>
    </div>
  );
}

function InfoPopoverButton({
  open,
  onToggle,
  onClose,
  paper,
  isLibraryPaper,
  paperCollections,
  paperTags,
  collections,
  tags,
  showCollectionPicker,
  setShowCollectionPicker,
  showTagPicker,
  setShowTagPicker,
  handleToggleCollection,
  handleToggleTag,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  paper: {
    title: string;
    authors: string[];
    publishedDate: string;
    categories: string[];
    arxivUrl: string;
    id?: string;
    arxivId?: string;
  };
  isLibraryPaper: boolean;
  paperCollections: Collection[];
  paperTags: Tag[];
  collections: Collection[];
  tags: Tag[];
  showCollectionPicker: boolean;
  setShowCollectionPicker: (v: boolean) => void;
  showTagPicker: boolean;
  setShowTagPicker: (v: boolean) => void;
  handleToggleCollection: (id: string) => void;
  handleToggleTag: (id: string) => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="no-drag flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
        title="Paper info"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="8" cy="8" r="6.5" />
          <line x1="8" y1="7" x2="8" y2="11.5" />
          <circle cx="8" cy="5" r="0.5" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-1 w-80 max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-mac-separator z-20 p-4 space-y-3"
        >
          <h2 className="text-mac-body font-semibold leading-snug">{paper.title}</h2>

          <div className="flex flex-wrap gap-1">
            {paper.authors.map((author) => (
              <span key={author} className="text-mac-small text-mac-accent">
                {author}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 text-mac-small text-gray-500">
            <span>{formatDate(paper.publishedDate)}</span>
            <span>
              arXiv: {'arxivId' in paper ? (paper as { arxivId: string }).arxivId : (paper as { id: string }).id}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {paper.categories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                {cat}
              </span>
            ))}
          </div>

          {isLibraryPaper && (
            <div className="flex flex-wrap items-center gap-1.5">
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

          <div className="border-t border-mac-separator pt-3 flex gap-2">
            <a
              href={paper.arxivUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="no-drag px-3 py-1 rounded-md text-mac-small font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Open on arXiv
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
