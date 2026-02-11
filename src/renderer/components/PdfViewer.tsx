import type { PDFPageProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PdfPage } from './pdf/PdfPage';
import { usePdfDocument } from './pdf/usePdfDocument';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;
const PINCH_COMMIT_DELAY_MS = 150;

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
        className="w-full h-20 text-mac-small resize-none rounded border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="px-2 py-0.5 text-mac-small rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-2 py-0.5 text-mac-small rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmPopup({
  x,
  y,
  onConfirm,
  onCancel,
}: {
  x: number;
  y: number;
  onConfirm: () => void;
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
      className="fixed z-50 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3"
      style={{ left: x, top: y }}
    >
      <p className="text-mac-small mb-2">Delete this annotation?</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-2 py-0.5 text-mac-small rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-2 py-0.5 text-mac-small rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function PdfViewer({ paperId, pdfUrl, arxivId }: { paperId?: string; pdfUrl?: string; arxivId?: string }) {
  const readOnly = !paperId;
  const [scale, setScale] = useState(1.0);
  const [visualScale, setVisualScale] = useState(1.0);
  const [pdfVersion, setPdfVersion] = useState(0);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('read');
  const [pages, setPages] = useState<PDFPageProxy[]>([]);

  const [highlightToolbar, setHighlightToolbar] = useState<HighlightToolbarState | null>(null);
  const [stickyNotePopup, setStickyNotePopup] = useState<StickyNotePopupState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

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

  const { pdfDocument, numPages, loading, error } = usePdfDocument(paperId ?? null, pdfVersion, pdfUrl, arxivId);

  // Fetch all PDFPageProxy objects when document loads
  useEffect(() => {
    if (!pdfDocument) {
      setPages([]);
      return;
    }

    let cancelled = false;
    const fetchPages = async () => {
      const pagePromises: Promise<PDFPageProxy>[] = [];
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        pagePromises.push(pdfDocument.getPage(i));
      }
      const fetchedPages = await Promise.all(pagePromises);
      if (!cancelled) {
        setPages(fetchedPages);
      }
    };
    fetchPages();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument]);

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

  // Cmd+/Cmd- keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAnnotationMode('read');
        setHighlightToolbar(null);
        setStickyNotePopup(null);
        setDeleteConfirm(null);
        return;
      }
      if (!event.metaKey) return;
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        zoomIn();
      } else if (event.key === '-') {
        event.preventDefault();
        zoomOut();
      } else if (event.key === '0') {
        event.preventDefault();
        zoomReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, zoomReset]);

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
      if (!event.ctrlKey) return;
      const container = containerRef.current;
      if (!container?.contains(event.target as Node)) return;
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
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('wheel', handleWheel);
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    };
  }, [scale, prepareScaleCommit]);

  // Adjust scroll position after scale commit
  // biome-ignore lint/correctness/useExhaustiveDependencies: must fire when scale changes
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

  const cycleAnnotationMode = useCallback(() => {
    setAnnotationMode((current) => {
      if (current === 'read') return 'highlight';
      if (current === 'highlight') return 'note';
      return 'read';
    });
    setHighlightToolbar(null);
    setStickyNotePopup(null);
    setDeleteConfirm(null);
  }, []);

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
      <div className="flex-shrink-0 flex items-center justify-center gap-3 px-4 py-2 border-b border-mac-separator bg-white/60 dark:bg-black/20">
        <button
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="no-drag px-2 py-0.5 rounded text-mac-small font-medium hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
        >
          -
        </button>
        <button
          onClick={zoomReset}
          className="no-drag px-2 py-0.5 rounded text-mac-small font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[4rem] text-center"
        >
          {Math.round(visualScale * 100)}%
        </button>
        <button
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="no-drag px-2 py-0.5 rounded text-mac-small font-medium hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
        >
          +
        </button>
        {numPages > 0 && <span className="text-mac-small text-gray-400 ml-2">{numPages} pages</span>}

        {!readOnly && (
          <div className="ml-4 border-l border-mac-separator pl-4">
            <button
              onClick={cycleAnnotationMode}
              className={`no-drag px-2.5 py-0.5 rounded text-mac-small font-medium transition-colors ${
                annotationMode !== 'read' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={
                annotationMode === 'read'
                  ? 'Enter highlight mode'
                  : annotationMode === 'highlight'
                    ? 'Switch to sticky note mode'
                    : 'Exit annotation mode'
              }
            >
              {annotationMode === 'read' && 'Annotate'}
              {annotationMode === 'highlight' && 'Highlight'}
              {annotationMode === 'note' && 'Note'}
            </button>
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
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
        <DeleteConfirmPopup
          x={deleteConfirm.x}
          y={deleteConfirm.y}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
