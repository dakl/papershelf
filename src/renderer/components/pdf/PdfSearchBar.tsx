import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchMatch {
  /** The text layer <span> containing this match */
  span: HTMLElement;
  /** Character offset within the span's textContent where the match starts */
  startOffset: number;
  /** Length of the matched text */
  length: number;
  /** Page index (0-based) */
  pageIndex: number;
}

interface PdfSearchBarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

function findMatchesInTextLayers(container: HTMLElement, query: string): SearchMatch[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  const matches: SearchMatch[] = [];

  // Get all page wrappers in order
  const pageWrappers = container.querySelectorAll<HTMLElement>('[data-page-index]');

  for (const wrapper of pageWrappers) {
    const pageIndex = Number.parseInt(wrapper.getAttribute('data-page-index') || '0', 10);
    const textLayer = wrapper.querySelector('.textLayer');
    if (!textLayer) continue;

    const spans = textLayer.querySelectorAll<HTMLElement>('span');
    for (const span of spans) {
      const text = span.textContent || '';
      const lowerText = text.toLowerCase();
      let searchFrom = 0;

      while (searchFrom < lowerText.length) {
        const idx = lowerText.indexOf(lowerQuery, searchFrom);
        if (idx === -1) break;
        matches.push({ span, startOffset: idx, length: query.length, pageIndex });
        searchFrom = idx + 1;
      }
    }
  }

  return matches;
}

function clearHighlights(container: HTMLElement) {
  for (const el of container.querySelectorAll('.pdf-search-highlight')) {
    el.remove();
  }
}

function highlightMatches(matches: SearchMatch[], currentIndex: number) {
  // Group by page wrapper to batch DOM reads
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const span = match.span;
    const pageWrapper = span.closest('[data-page-index]') as HTMLElement;
    if (!pageWrapper) continue;

    // We need to measure where the matched substring is within the span.
    // Use a Range to get the bounding rect of the matched characters.
    const textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;

    const range = document.createRange();
    try {
      range.setStart(textNode, match.startOffset);
      range.setEnd(textNode, match.startOffset + match.length);
    } catch {
      continue;
    }

    const rects = range.getClientRects();
    const wrapperRect = pageWrapper.getBoundingClientRect();

    for (const rect of rects) {
      if (rect.width === 0 || rect.height === 0) continue;
      const highlight = document.createElement('div');
      highlight.className =
        i === currentIndex ? 'pdf-search-highlight pdf-search-highlight-current' : 'pdf-search-highlight';
      highlight.style.position = 'absolute';
      highlight.style.left = `${rect.left - wrapperRect.left}px`;
      highlight.style.top = `${rect.top - wrapperRect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.pointerEvents = 'none';
      if (i === currentIndex) {
        highlight.setAttribute('data-current', 'true');
      }
      pageWrapper.appendChild(highlight);
    }
  }
}

export function PdfSearchBar({ containerRef, onClose }: PdfSearchBarProps) {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Auto-commit query when 2+ characters; clear when empty
  useEffect(() => {
    if (query.length >= 2) {
      setActiveQuery(query);
    } else if (query.length === 0) {
      setActiveQuery('');
    }
  }, [query]);

  // Find matches when activeQuery changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!activeQuery) {
      setMatches([]);
      setCurrentIndex(0);
      return;
    }

    const found = findMatchesInTextLayers(container, activeQuery);
    setMatches(found);
    setCurrentIndex(0);
  }, [activeQuery, containerRef]);

  // Highlight matches and scroll to current
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    clearHighlights(container);
    if (matches.length === 0) return;

    highlightMatches(matches, currentIndex);

    const currentHighlight = container.querySelector('.pdf-search-highlight-current');
    if (currentHighlight) {
      currentHighlight.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentIndex, matches, containerRef]);

  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        if (query.length === 1 && activeQuery !== query) {
          setActiveQuery(query);
        } else {
          goToPrev();
        }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (query.length === 1 && activeQuery !== query) {
          setActiveQuery(query);
        } else {
          goToNext();
        }
      } else if (event.key === 'g' && event.metaKey && event.shiftKey) {
        event.preventDefault();
        goToPrev();
      } else if (event.key === 'g' && event.metaKey) {
        event.preventDefault();
        goToNext();
      }
    },
    [onClose, goToNext, goToPrev, query, activeQuery],
  );

  // Clean up highlights on unmount
  useEffect(() => {
    return () => {
      const container = containerRef.current;
      if (container) clearHighlights(container);
    };
  }, [containerRef]);

  return (
    <div
      className="absolute top-2 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find in PDF..."
        className="w-48 text-mac-small bg-transparent border-none outline-none placeholder-gray-400"
      />
      {query && (
        <span className="text-mac-small text-gray-400 whitespace-nowrap">
          {matches.length > 0 ? `${currentIndex + 1} of ${matches.length}` : 'No matches'}
        </span>
      )}
      <div className="flex gap-0.5">
        <button
          onClick={goToPrev}
          disabled={matches.length === 0}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Previous match (Shift+Enter)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 8L6 4L10 8" />
          </svg>
        </button>
        <button
          onClick={goToNext}
          disabled={matches.length === 0}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Next match (Enter)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 4L6 8L10 4" />
          </svg>
        </button>
      </div>
      <button
        onClick={onClose}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Close (Escape)"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1L9 9M9 1L1 9" />
        </svg>
      </button>
    </div>
  );
}
