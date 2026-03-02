import type { PDFPageProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ConfirmPopup } from './ConfirmPopup';
import { HighlightIcon, StickyNoteIcon } from './Icons';
import { PdfPage, selectionRectsToQuadPoints } from './pdf/PdfPage';
import { PdfSearchBar } from './pdf/PdfSearchBar';
import { usePdfDocument } from './pdf/usePdfDocument';
import { ShortcutHint, Tooltip } from './ShortcutHint';
import { buildKeyString, useShortcutStore } from '../stores/shortcutStore';

const MIN_SCALE = 0.5;
const MAX_SCALE = 10.0;
const SCALE_STEP = 0.25;
const PINCH_COMMIT_DELAY_MS = 150;
const VIEWER_STATE_SAVE_DELAY_MS = 500;

type AnnotationMode = 'read' | 'highlight' | 'note';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', hex: '#FFEB3B' },
  { name: 'Green', hex: '#4CAF50' },
  { name: 'Blue', hex: '#2196F3' },
  { name: 'Pink', hex: '#E91E63' },
  { name: 'Orange', hex: '#FF9800' },
];

const NOTE_COLORS = HIGHLIGHT_COLORS;

interface PageDimensions {
  width: number;
  height: number;
}

interface HighlightToolbarState {
  x: number;
  y: number;
  pageIndex: number;
  quadPoints: number[];
}

interface StickyNotePopupState {
  x: number;
  y: number;
  pageIndex: number;
  pdfX: number;
  pdfY: number;
}

interface AnnotationInfo {
  nm: string;
  rect: number[];
  subtype: string;
}

interface DeleteConfirmState {
  x: number;
  y: number;
  pageIndex: number;
  annotationNm: string;
}

function HighlightToolbar({
  x,
  y,
  onColorPick,
  onCancel,
}: {
  x: number;
  y: number;
  onColorPick: (color: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="fixed z-50 flex gap-1 px-2 py-1.5 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      style={{ left: x, top: y + 4 }}
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color.hex}
          title={color.name}
          onClick={() => onColorPick(color.hex)}
          className="w-6 h-6 rounded-full border-2 border-transparent hover:border-gray-400 transition-colors"
          style={{ backgroundColor: color.hex }}
        />
      ))}
    </div>
  );
}

function StickyNotePopup({
  x,
  y,
  onSubmit,
  onCancel,
}: {
  x: number;
  y: number;
  onSubmit: (text: string, color: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0].hex);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed) onSubmit(trimmed, selectedColor);
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3"
      style={{ left: x, top: y }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter note text..."
        className="w-full h-20 text-mac-small resize-none rounded-sm border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.metaKey) handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          {NOTE_COLORS.map((color) => (
            <button
              key={color.hex}
              title={color.name}
              onClick={() => setSelectedColor(color.hex)}
              className="w-5 h-5 rounded-full transition-all"
              style={{
                backgroundColor: color.hex,
                outline: selectedColor === color.hex ? '2px solid currentColor' : 'none',
                outlineOffset: '1px',
              }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onCancel}
            className="px-2 py-0.5 text-mac-small rounded-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-2 py-0.5 text-mac-small rounded-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export function PdfViewer({
  paperId,
  pdfUrl,
  arxivId,
  authors,
  headerTitle,
  headerActions,
}: {
  paperId?: string;
  pdfUrl?: string;
  arxivId?: string;
  authors?: string[];
  headerTitle?: React.ReactNode;
  headerActions?: React.ReactNode;
}) {
  const readOnly = !paperId;
  const commandDown = useShortcutStore((s) => s.commandDown);
  const [scale, setScale] = useState(1.0);
  const [visualScale, setVisualScale] = useState(1.0);
  const [pdfVersion, setPdfVersion] = useState(0);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('read');
  const [pages, setPages] = useState<PDFPageProxy[]>([]);

  const [highlightToolbar, setHighlightToolbar] = useState<HighlightToolbarState | null>(null);
  const [stickyNotePopup, setStickyNotePopup] = useState<StickyNotePopupState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const isPinching = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageDimensionsRef = useRef<Map<number, PageDimensions>>(new Map());
  const annotationMapRef = useRef<Map<string, AnnotationInfo>>(new Map());
  const pendingScrollRef = useRef<{
    fractionX: number;
    fractionY: number;
    expectedWidth: number;
    expectedHeight: number;
    pointerOffsetX?: number;
    pointerOffsetY?: number;
  } | null>(null);
  const scrollRestoreRef = useRef<{ scrollTop: number; scrollLeft: number } | null>(null);
  const pointerPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const [pendingScroll, setPendingScroll] = useState<{ scrollTop: number; scrollLeft: number } | null>(null);
  const initialStateLoadedRef = useRef(false);
  const viewerStateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ scale: number; scrollTop: number; scrollLeft: number } | null>(null);

  const { pdfDocument, numPages, loading, error } = usePdfDocument(paperId ?? null, pdfVersion, pdfUrl, arxivId);

  // Fetch all PDFPageProxy objects when document loads
  useEffect(() => {
    if (!pdfDocument) {
      setPages([]);
      return;
    }

    let cancelled = false;
    const fetchPages = async () => {
      try {
        const pagePromises: Promise<PDFPageProxy>[] = [];
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          pagePromises.push(pdfDocument.getPage(i));
        }
        const fetchedPages = await Promise.all(pagePromises);
        if (!cancelled) {
          setPages(fetchedPages);
        }
      } catch {
        // Document was destroyed during paper switch — ignore
      }
    };
    fetchPages();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument]);

  // --- Viewer state persistence (library papers only) ---

  const flushViewerState = useCallback(() => {
    if (!paperId) return;
    const container = containerRef.current;
    if (!container) return;
    const currentScale = scaleRef.current;
    const { scrollTop, scrollLeft } = container;
    const last = lastSavedRef.current;
    if (last && last.scale === currentScale && last.scrollTop === scrollTop && last.scrollLeft === scrollLeft) return;
    lastSavedRef.current = { scale: currentScale, scrollTop, scrollLeft };
    window.electronAPI.saveViewerState(paperId, currentScale, scrollTop, scrollLeft);
  }, [paperId]);

  const debouncedSaveViewerState = useCallback(() => {
    if (viewerStateSaveTimerRef.current) clearTimeout(viewerStateSaveTimerRef.current);
    viewerStateSaveTimerRef.current = setTimeout(flushViewerState, VIEWER_STATE_SAVE_DELAY_MS);
  }, [flushViewerState]);

  // Load saved state when paperId changes
  useEffect(() => {
    initialStateLoadedRef.current = false;
    setPendingScroll(null);
    lastSavedRef.current = null;
    if (!paperId) return;
    window.electronAPI.getViewerState(paperId).then((state) => {
      if (!state) {
        initialStateLoadedRef.current = true;
        return;
      }
      setScale(state.scale);
      setVisualScale(state.scale);
      setPendingScroll({ scrollTop: state.scrollTop, scrollLeft: state.scrollLeft });
      initialStateLoadedRef.current = true;
    });
  }, [paperId]);

  // Restore scroll position once pages are rendered and pendingScroll is set
  useEffect(() => {
    if (!pendingScroll || pages.length === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollLeft } = pendingScroll;
    setPendingScroll(null);
    requestAnimationFrame(() => {
      container.scrollTop = scrollTop;
      container.scrollLeft = scrollLeft;
    });
  }, [pendingScroll, pages]);

  // Save on scroll (passive listener, debounced)
  useEffect(() => {
    if (!paperId) return;
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (initialStateLoadedRef.current) debouncedSaveViewerState();
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [paperId, debouncedSaveViewerState]);

  // Save on zoom change (skip initial load)
  // biome-ignore lint/correctness/useExhaustiveDependencies: scale triggers save on zoom
  useEffect(() => {
    if (!paperId || !initialStateLoadedRef.current) return;
    debouncedSaveViewerState();
  }, [scale, paperId, debouncedSaveViewerState]);

  // Flush on unmount / paperId change
  useEffect(() => {
    return () => {
      if (viewerStateSaveTimerRef.current) clearTimeout(viewerStateSaveTimerRef.current);
      flushViewerState();
    };
  }, [flushViewerState]);

  // Save scroll position before annotation reload
  const prevPdfVersionRef = useRef(pdfVersion);
  useEffect(() => {
    if (pdfVersion > prevPdfVersionRef.current) {
      const container = containerRef.current;
      if (container) {
        scrollRestoreRef.current = {
          scrollTop: container.scrollTop,
          scrollLeft: container.scrollLeft,
        };
      }
    }
    prevPdfVersionRef.current = pdfVersion;
  }, [pdfVersion]);

  const reloadPdf = useCallback(() => {
    setPdfVersion((v) => v + 1);
  }, []);

  // Restore scroll position after annotation reload
  // biome-ignore lint/correctness/useExhaustiveDependencies: pdfVersion triggers restore
  useLayoutEffect(() => {
    const saved = scrollRestoreRef.current;
    const container = containerRef.current;
    if (!saved || !container) return;
    scrollRestoreRef.current = null;
    container.scrollTop = saved.scrollTop;
    container.scrollLeft = saved.scrollLeft;
  }, [pages, pdfVersion]);

  // Save scroll fractions before committing a scale change.
  // No snapshot needed — double-buffered canvases handle visual continuity.
  const prepareScaleCommit = useCallback((nextScale: number) => {
    const currentScale = scaleRef.current;
    const container = containerRef.current;
    if (!container || nextScale === currentScale) return;

    const ratio = nextScale / currentScale;
    const containerRect = container.getBoundingClientRect();
    const pointer = pointerPosRef.current;
    const offsetX = pointer ? pointer.clientX - containerRect.left : container.clientWidth / 2;
    const offsetY = pointer ? pointer.clientY - containerRect.top : container.clientHeight / 2;
    const fractionX =
      container.scrollWidth > container.clientWidth ? (container.scrollLeft + offsetX) / container.scrollWidth : 0.5;
    const fractionY =
      container.scrollHeight > container.clientHeight ? (container.scrollTop + offsetY) / container.scrollHeight : 0.5;

    pendingScrollRef.current = {
      fractionX,
      fractionY,
      expectedWidth: container.scrollWidth * ratio,
      expectedHeight: container.scrollHeight * ratio,
      pointerOffsetX: offsetX,
      pointerOffsetY: offsetY,
    };
  }, []);

  const zoomIn = useCallback(() => {
    const next = Math.min(MAX_SCALE, Math.round((scale + SCALE_STEP) * 100) / 100);
    pointerPosRef.current = null;
    prepareScaleCommit(next);
    setScale(next);
    setVisualScale(next);
  }, [scale, prepareScaleCommit]);
  const zoomOut = useCallback(() => {
    const next = Math.max(MIN_SCALE, Math.round((scale - SCALE_STEP) * 100) / 100);
    pointerPosRef.current = null;
    prepareScaleCommit(next);
    setScale(next);
    setVisualScale(next);
  }, [scale, prepareScaleCommit]);
  const zoomReset = useCallback(() => {
    pointerPosRef.current = null;
    prepareScaleCommit(1.0);
    setScale(1.0);
    setVisualScale(1.0);
  }, [prepareScaleCommit]);

  const closeSearch = useCallback(() => setShowSearch(false), []);

  // Pinch-to-zoom
  useEffect(() => {
    let latestVisualScale = scale;

    const commitZoom = () => {
      isPinching.current = false;
      const finalScale = latestVisualScale;
      prepareScaleCommit(finalScale);
      setScale(finalScale);
      setVisualScale(finalScale);
    };

    const handleWheel = (event: WheelEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Pinch-to-zoom: ctrlKey is set by trackpad pinch gestures
      if (event.ctrlKey) {
        if (!container.contains(event.target as Node)) return;
        event.preventDefault();

        pointerPosRef.current = { clientX: event.clientX, clientY: event.clientY };

        const delta = -event.deltaY;
        const nextVisualScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, latestVisualScale + delta * 0.01));
        latestVisualScale = nextVisualScale;
        isPinching.current = true;
        setVisualScale(nextVisualScale);

        if (contentRef.current) {
          const cssScale = nextVisualScale / scale;
          contentRef.current.style.transform = `scale(${cssScale})`;
          const containerRect = container.getBoundingClientRect();
          const originX = container.scrollLeft + (event.clientX - containerRect.left);
          const originY = container.scrollTop + (event.clientY - containerRect.top);
          contentRef.current.style.transformOrigin = `${originX}px ${originY}px`;
        }

        if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
        commitTimeoutRef.current = setTimeout(commitZoom, PINCH_COMMIT_DELAY_MS);
        return;
      }

      // Diagonal scroll fix: bypass Chromium's trackpad axis-locking
      if (!container.contains(event.target as Node)) return;
      if (event.deltaX !== 0 && event.deltaY !== 0) {
        event.preventDefault();
        container.scrollLeft += event.deltaX;
        container.scrollTop += event.deltaY;
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('wheel', handleWheel);
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    };
  }, [scale, prepareScaleCommit]);

  // Adjust scroll position after scale commit
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    const container = containerRef.current;
    const content = contentRef.current;
    if (!pending || !container || !content) return;
    pendingScrollRef.current = null;

    content.style.transform = '';
    content.style.transformOrigin = '';

    // Resize page wrappers to expected new-scale dimensions so the content div's
    // scrollWidth/scrollHeight match what the scroll fraction calculation expects.
    // Apply a CSS scale bridge on the old canvas so it visually fills the wrapper.
    const pageWrappers = content.querySelectorAll<HTMLElement>('[data-pdf-width]');
    for (const wrapper of pageWrappers) {
      const pdfWidth = wrapper.getAttribute('data-pdf-width');
      const pdfHeight = wrapper.getAttribute('data-pdf-height');
      if (pdfWidth && pdfHeight) {
        const newWidth = Math.floor(Number.parseFloat(pdfWidth) * scale);
        const newHeight = Math.floor(Number.parseFloat(pdfHeight) * scale);
        wrapper.style.width = `${newWidth}px`;
        wrapper.style.height = `${newHeight}px`;
        wrapper.style.overflow = 'hidden';

        const canvas = wrapper.querySelector('canvas');
        if (canvas) {
          const oldCssWidth = Number.parseFloat(canvas.style.width);
          if (oldCssWidth > 0) {
            const canvasRatio = newWidth / oldCssWidth;
            canvas.style.transform = `scale(${canvasRatio})`;
            canvas.style.transformOrigin = '0 0';
          }
        }
      }
    }

    content.style.minWidth = `${pending.expectedWidth}px`;
    content.style.minHeight = `${pending.expectedHeight}px`;

    const offsetX = pending.pointerOffsetX ?? container.clientWidth / 2;
    const offsetY = pending.pointerOffsetY ?? container.clientHeight / 2;
    container.scrollLeft = Math.max(0, pending.fractionX * pending.expectedWidth - offsetX);
    container.scrollTop = Math.max(0, pending.fractionY * pending.expectedHeight - offsetY);
  }, [scale]);

  // Page dimension tracking
  const handlePageLoaded = useCallback((pageNumber: number, dimensions: PageDimensions) => {
    pageDimensionsRef.current.set(pageNumber, dimensions);
  }, []);

  // Highlight flow
  const handleTextSelected = useCallback(
    (pageIndex: number, quadPoints: number[], screenX: number, screenY: number) => {
      setHighlightToolbar({ x: screenX, y: screenY, pageIndex, quadPoints });
    },
    [],
  );

  const handleHighlightColorPick = useCallback(
    async (color: string) => {
      if (!highlightToolbar) return;
      const { pageIndex, quadPoints } = highlightToolbar;
      setHighlightToolbar(null);
      window.getSelection()?.removeAllRanges();

      const result = await window.electronAPI.addHighlight({
        paperId,
        pageIndex,
        quadPoints,
        color,
      });

      if (result.success) {
        reloadPdf();
      }
    },
    [highlightToolbar, paperId, reloadPdf],
  );

  // Sticky note flow
  const handlePageClicked = useCallback(
    (pageIndex: number, pdfX: number, pdfY: number, screenX: number, screenY: number) => {
      setStickyNotePopup({ x: screenX, y: screenY, pageIndex, pdfX, pdfY });
    },
    [],
  );

  const handleStickyNoteSubmit = useCallback(
    async (text: string, color: string) => {
      if (!stickyNotePopup) return;
      const { pageIndex, pdfX, pdfY } = stickyNotePopup;
      setStickyNotePopup(null);

      const result = await window.electronAPI.addStickyNote({
        paperId,
        pageIndex,
        x: pdfX,
        y: pdfY,
        text,
        color,
      });

      if (result.success) {
        reloadPdf();
      }
    },
    [stickyNotePopup, paperId, reloadPdf],
  );

  // Delete flow
  const handleAnnotationClicked = useCallback(
    (pageIndex: number, annotationNm: string, screenX: number, screenY: number) => {
      setDeleteConfirm({ x: screenX, y: screenY, pageIndex, annotationNm });
    },
    [],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    const { pageIndex, annotationNm } = deleteConfirm;
    setDeleteConfirm(null);

    const result = await window.electronAPI.removeAnnotation(paperId, pageIndex, annotationNm);
    if (result.success) {
      reloadPdf();
    }
  }, [deleteConfirm, paperId, reloadPdf]);

  // Listen for keyboard shortcut to highlight current text selection
  useEffect(() => {
    if (readOnly) return;
    const handleHighlightShortcut = async () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const pageEl =
        (range.commonAncestorContainer as HTMLElement).closest?.('[data-pdf-width]') ??
        range.commonAncestorContainer.parentElement?.closest('[data-pdf-width]');
      if (!pageEl) return;

      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (rects.length === 0) return;

      const widthAttr = pageEl.getAttribute('data-pdf-width');
      const heightAttr = pageEl.getAttribute('data-pdf-height');
      const pageIndexAttr = pageEl.getAttribute('data-page-index');
      if (!widthAttr || !heightAttr || pageIndexAttr == null) return;

      const pageDimensions = { width: Number.parseFloat(widthAttr), height: Number.parseFloat(heightAttr) };
      const quadPoints = selectionRectsToQuadPoints(rects, pageEl as HTMLElement, scaleRef.current, pageDimensions);
      selection.removeAllRanges();

      const result = await window.electronAPI.addHighlight({
        paperId: paperId!,
        pageIndex: Number.parseInt(pageIndexAttr, 10),
        quadPoints,
        color: HIGHLIGHT_COLORS[0].hex,
      });
      if (result.success) reloadPdf();
    };
    document.addEventListener('shortcut:highlightSelection', handleHighlightShortcut);
    return () => document.removeEventListener('shortcut:highlightSelection', handleHighlightShortcut);
  }, [readOnly, paperId, reloadPdf]);

  const toggleHighlightMode = useCallback(() => {
    setAnnotationMode((current) => (current === 'highlight' ? 'read' : 'highlight'));
    setHighlightToolbar(null);
    setStickyNotePopup(null);
    setDeleteConfirm(null);
  }, []);

  const toggleNoteMode = useCallback(() => {
    setAnnotationMode((current) => (current === 'note' ? 'read' : 'note'));
    setHighlightToolbar(null);
    setStickyNotePopup(null);
    setDeleteConfirm(null);
  }, []);

  // Keyboard shortcuts (reads from shortcut store so remapping works)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          return;
        }
        setAnnotationMode('read');
        setHighlightToolbar(null);
        setStickyNotePopup(null);
        setDeleteConfirm(null);
        return;
      }
      // Zoom: fixed Cmd+/- shortcuts (not remappable)
      if (event.metaKey) {
        if (event.key === '=' || event.key === '+') {
          zoomIn();
          return;
        }
        if (event.key === '-') {
          zoomOut();
          return;
        }
        if (event.key === '0') {
          zoomReset();
          return;
        }
      }
      // Remappable shortcuts via store
      const keyString = buildKeyString(event);
      if (!keyString) return;
      const shortcut = useShortcutStore.getState().shortcuts.find((s) => s.keys === keyString);
      if (!shortcut) return;
      switch (shortcut.id) {
        case 'findInPdf':
          event.preventDefault();
          setShowSearch(true);
          break;
        case 'highlightSelection':
          event.preventDefault();
          toggleHighlightMode();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, toggleHighlightMode, zoomIn, zoomOut, zoomReset]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-mac-body">Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-mac-body select-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-4 pt-2 pb-1.5 border-b border-mac-separator flex flex-col gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-1 min-w-0">{headerTitle}</div>
          <div className="shrink-0 flex items-center gap-0.5 text-gray-400">
            <button
              onClick={zoomOut}
              disabled={scale <= MIN_SCALE}
              className="no-drag px-1 py-0.5 rounded-sm text-mac-small font-medium hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
            >
              -
            </button>
            <button
              onClick={zoomReset}
              className="no-drag px-0.5 py-0.5 rounded-sm text-mac-small font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-center"
            >
              {Math.round(visualScale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
              className="no-drag px-1 py-0.5 rounded-sm text-mac-small font-medium hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
            >
              +
            </button>
            {numPages > 0 && <span className="text-mac-small ml-0.5">{numPages}p</span>}
          </div>
        </div>
        <div className="flex items-center min-w-0">
          {authors && authors.length > 0 && (
            <p className="flex-1 text-mac-small text-gray-500 truncate min-w-0">{authors.join(', ')}</p>
          )}
          {commandDown && (
            <div className="shrink-0 flex items-center gap-1.5 mr-2" style={{ animation: 'shortcut-fade-in 100ms ease-out' }}>
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none bg-gray-800/90 text-white dark:bg-gray-200/90 dark:text-gray-900 shadow-xs">
                <span>⌘+/⌘−</span>
                <span className="opacity-70">Zoom</span>
              </span>
              {showSearch && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none bg-gray-800/90 text-white dark:bg-gray-200/90 dark:text-gray-900 shadow-xs">
                  <span>⌘G</span>
                  <span className="opacity-70">Find Next/Prev</span>
                </span>
              )}
            </div>
          )}
          <div className="shrink-0 flex items-center gap-0.5 ml-auto">
            {headerActions}
            <div className="w-px h-4 bg-mac-separator mx-1" />
            <ShortcutHint shortcutId="findInPdf" label="Find In PDF">
              <button
                onClick={() => setShowSearch(true)}
                className={`no-drag w-7 h-7 flex items-center justify-center rounded transition-colors ${
                  showSearch
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="4.25" />
                  <path d="M9 9L12.5 12.5" />
                </svg>
              </button>
            </ShortcutHint>
            {!readOnly && (
              <>
                <ShortcutHint shortcutId="highlightSelection" label="Highlight">
                  <button
                    onClick={toggleHighlightMode}
                    className={`no-drag w-7 h-7 flex items-center justify-center rounded transition-colors ${
                      annotationMode === 'highlight'
                        ? 'bg-blue-500 text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <HighlightIcon />
                  </button>
                </ShortcutHint>
                <Tooltip label={annotationMode === 'note' ? 'Exit Sticky Note Mode' : 'Sticky Note'} position="below" align="end">
                  <button
                    onClick={toggleNoteMode}
                    className={`no-drag w-7 h-7 flex items-center justify-center rounded transition-colors ${
                      annotationMode === 'note'
                        ? 'bg-blue-500 text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <StickyNoteIcon />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative flex-1">
        {showSearch && <PdfSearchBar containerRef={containerRef} onClose={closeSearch} />}
        <div ref={containerRef} className="absolute inset-0 overflow-auto bg-gray-100 dark:bg-gray-900">
        <div ref={contentRef} style={{ willChange: 'transform' }}>
          {pages.map((page, index) => (
            <PdfPage
              key={`page-${index + 1}`}
              page={page}
              paperId={paperId}
              pageNumber={index + 1}
              scale={scale}
              annotationMode={annotationMode}
              onPageLoaded={handlePageLoaded}
              onTextSelected={handleTextSelected}
              onPageClicked={handlePageClicked}
              onAnnotationClicked={handleAnnotationClicked}
              annotationMap={annotationMapRef}
              pdfVersion={pdfVersion}
            />
          ))}
        </div>
        </div>
      </div>

      {highlightToolbar && (
        <HighlightToolbar
          x={highlightToolbar.x}
          y={highlightToolbar.y}
          onColorPick={handleHighlightColorPick}
          onCancel={() => {
            setHighlightToolbar(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}

      {stickyNotePopup && (
        <StickyNotePopup
          x={stickyNotePopup.x}
          y={stickyNotePopup.y}
          onSubmit={handleStickyNoteSubmit}
          onCancel={() => setStickyNotePopup(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmPopup
          x={deleteConfirm.x}
          y={deleteConfirm.y}
          message="Delete this annotation?"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
