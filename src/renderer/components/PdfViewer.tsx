import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

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

function screenToPdfCoords(
  clientX: number,
  clientY: number,
  pageElement: HTMLElement,
  scale: number,
  pageDimensions: PageDimensions,
): { pdfX: number; pdfY: number } {
  const rect = pageElement.getBoundingClientRect();
  const relativeX = clientX - rect.left;
  const relativeY = clientY - rect.top;
  const pdfX = relativeX / scale;
  const pdfY = pageDimensions.height - relativeY / scale;
  return { pdfX, pdfY };
}

function mergeOverlappingRects(rects: DOMRect[]): DOMRect[] {
  if (rects.length === 0) return [];

  // Sort by top position, then left
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left);
  const merged: DOMRect[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Rects overlap if they share similar vertical position and overlap horizontally
    const verticalOverlap = current.top < last.bottom - 1 && current.bottom > last.top + 1;
    const horizontalOverlap = current.left < last.right + 1;

    if (verticalOverlap && horizontalOverlap) {
      // Merge by expanding the last rect
      const newLeft = Math.min(last.left, current.left);
      const newTop = Math.min(last.top, current.top);
      const newRight = Math.max(last.right, current.right);
      const newBottom = Math.max(last.bottom, current.bottom);
      merged[merged.length - 1] = new DOMRect(newLeft, newTop, newRight - newLeft, newBottom - newTop);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function selectionRectsToQuadPoints(
  rects: DOMRect[],
  pageElement: HTMLElement,
  scale: number,
  pageDimensions: PageDimensions,
): number[] {
  const quadPoints: number[] = [];
  const pageRect = pageElement.getBoundingClientRect();
  const dedupedRects = mergeOverlappingRects(rects);

  for (const domRect of dedupedRects) {
    const relLeft = (domRect.left - pageRect.left) / scale;
    const relRight = (domRect.right - pageRect.left) / scale;
    const relTop = (domRect.top - pageRect.top) / scale;
    const relBottom = (domRect.bottom - pageRect.top) / scale;

    // PDF Y is flipped (origin at bottom-left)
    const pdfTop = pageDimensions.height - relTop;
    const pdfBottom = pageDimensions.height - relBottom;

    // QuadPoints order per PDF spec: top-left, top-right, bottom-left, bottom-right
    quadPoints.push(relLeft, pdfTop, relRight, pdfTop, relLeft, pdfBottom, relRight, pdfBottom);
  }

  return quadPoints;
}

function PdfPage({
  paperId,
  pageNumber,
  scale,
  annotationMode,
  onPageLoaded,
  onTextSelected,
  onPageClicked,
  onAnnotationClicked,
  annotationMap,
  pdfVersion,
}: {
  paperId: string;
  pageNumber: number;
  scale: number;
  annotationMode: AnnotationMode;
  onPageLoaded: (pageNumber: number, dimensions: PageDimensions) => void;
  onTextSelected: (pageIndex: number, quadPoints: number[], screenX: number, screenY: number) => void;
  onPageClicked: (pageIndex: number, pdfX: number, pdfY: number, screenX: number, screenY: number) => void;
  onAnnotationClicked: (pageIndex: number, annotationNm: string, screenX: number, screenY: number) => void;
  annotationMap: React.MutableRefObject<Map<string, AnnotationInfo>>;
  pdfVersion: number;
}) {
  const pageRef = useRef<HTMLDivElement>(null);

  // Load our annotation metadata (NM values) for this page so we can map
  // pdfjs rendered annotations to our NM values for deletion
  // biome-ignore lint/correctness/useExhaustiveDependencies: pdfVersion intentionally triggers reload
  useEffect(() => {
    const pageIndex = pageNumber - 1;
    window.electronAPI.listAnnotations(paperId, pageIndex).then((entries) => {
      // Build rect-key → NM mapping. pdfjs data-annotation-id is internal,
      // so we'll match by rect when annotations render.
      for (const entry of entries) {
        // Store with rect as key for matching
        const rectKey = `${pageIndex}:${entry.rect.map((n) => n.toFixed(1)).join(',')}`;
        annotationMap.current.set(rectKey, { nm: entry.nm, rect: entry.rect, subtype: entry.subtype });
      }
    });
  }, [paperId, pageNumber, annotationMap, pdfVersion]);

  const handlePageLoadSuccess = useCallback(
    (page: { originalWidth: number; originalHeight: number }) => {
      onPageLoaded(pageNumber, { width: page.originalWidth, height: page.originalHeight });
    },
    [pageNumber, onPageLoaded],
  );

  const handleMouseUp = useCallback(
    (_event: React.MouseEvent) => {
      if (annotationMode !== 'highlight') return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;

      const pageEl = pageRef.current;
      if (!pageEl) return;

      // Check the selection actually intersects this page
      const range = selection.getRangeAt(0);
      if (!pageEl.contains(range.commonAncestorContainer)) return;

      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (rects.length === 0) return;

      // Get page dimensions from data attribute set during onLoadSuccess
      const widthAttr = pageEl.getAttribute('data-pdf-width');
      const heightAttr = pageEl.getAttribute('data-pdf-height');
      if (!widthAttr || !heightAttr) return;

      const pageDimensions = { width: Number.parseFloat(widthAttr), height: Number.parseFloat(heightAttr) };
      const quadPoints = selectionRectsToQuadPoints(rects, pageEl, scale, pageDimensions);

      // Position toolbar near the end of the selection
      const lastRect = rects[rects.length - 1];
      onTextSelected(pageNumber - 1, quadPoints, lastRect.right, lastRect.bottom);
    },
    [annotationMode, scale, pageNumber, onTextSelected],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      // Check for annotation click (works in any mode)
      const target = event.target as HTMLElement;
      const annotationSection = target.closest('.react-pdf__Page__annotations section') as HTMLElement | null;
      if (annotationSection) {
        // Match annotation by its rendered position → our rect-based key
        const pageEl = pageRef.current;
        if (pageEl) {
          const pageIndex = pageNumber - 1;
          const sectionRect = annotationSection.getBoundingClientRect();
          const pageRect = pageEl.getBoundingClientRect();

          // Convert screen position to PDF coordinates
          const widthAttr = pageEl.getAttribute('data-pdf-width');
          const heightAttr = pageEl.getAttribute('data-pdf-height');
          if (widthAttr && heightAttr) {
            const pageHeight = Number.parseFloat(heightAttr);
            const left = (sectionRect.left - pageRect.left) / scale;
            const bottom = pageHeight - (sectionRect.bottom - pageRect.top) / scale;
            const right = (sectionRect.right - pageRect.left) / scale;
            const top = pageHeight - (sectionRect.top - pageRect.top) / scale;
            const rectKey = `${pageIndex}:${[left, bottom, right, top].map((n) => n.toFixed(1)).join(',')}`;

            const info = annotationMap.current.get(rectKey);
            if (info) {
              onAnnotationClicked(pageIndex, info.nm, event.clientX, event.clientY);
              return;
            }
          }
        }
      }

      if (annotationMode !== 'note') return;

      const pageEl = pageRef.current;
      if (!pageEl) return;

      const widthAttr = pageEl.getAttribute('data-pdf-width');
      const heightAttr = pageEl.getAttribute('data-pdf-height');
      if (!widthAttr || !heightAttr) return;

      const pageDimensions = { width: Number.parseFloat(widthAttr), height: Number.parseFloat(heightAttr) };
      const { pdfX, pdfY } = screenToPdfCoords(event.clientX, event.clientY, pageEl, scale, pageDimensions);
      onPageClicked(pageNumber - 1, pdfX, pdfY, event.clientX, event.clientY);
    },
    [annotationMode, scale, pageNumber, onPageClicked, onAnnotationClicked, annotationMap],
  );

  return (
    <div
      ref={pageRef}
      className={`relative mx-auto my-4 ${annotationMode === 'highlight' ? 'annotate-highlight-mode' : ''}`}
      style={{ width: 'fit-content', cursor: annotationMode === 'note' ? 'crosshair' : undefined }}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderTextLayer={true}
        renderAnnotationLayer={true}
        onLoadSuccess={(page) => {
          handlePageLoadSuccess(page);
          if (pageRef.current) {
            pageRef.current.setAttribute('data-pdf-width', String(page.originalWidth));
            pageRef.current.setAttribute('data-pdf-height', String(page.originalHeight));
          }
        }}
      />
    </div>
  );
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

export function PdfViewer({ paperId }: { paperId: string }) {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);
  const [visualScale, setVisualScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfVersion, setPdfVersion] = useState(0);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('read');

  const [highlightToolbar, setHighlightToolbar] = useState<HighlightToolbarState | null>(null);
  const [stickyNotePopup, setStickyNotePopup] = useState<StickyNotePopupState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  const isPinching = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
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
  const prevPaperIdRef = useRef(paperId);

  // Load PDF bytes — pdfVersion triggers re-fetch after annotation mutations
  useEffect(() => {
    let cancelled = false;
    const paperChanged = paperId !== prevPaperIdRef.current;
    prevPaperIdRef.current = paperId;

    if (paperChanged) {
      // Full reset only when switching papers
      setLoading(true);
      setPdfData(null);
      setNumPages(0);
    } else if (pdfVersion > 0) {
      // Annotation reload — save scroll position, keep Document mounted
      const container = containerRef.current;
      if (container) {
        scrollRestoreRef.current = {
          scrollTop: container.scrollTop,
          scrollLeft: container.scrollLeft,
        };
      }
    }
    setError(null);

    window.electronAPI.getPdf(paperId).then((buffer) => {
      if (cancelled) return;
      if (!buffer) {
        setError('PDF file not found');
        setLoading(false);
        return;
      }
      const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
      const copy = new Uint8Array(source.length);
      copy.set(source);
      setPdfData(copy);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [paperId, pdfVersion]);

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
  }, [pdfData, pdfVersion]);

  const file = useMemo(() => (pdfData ? { data: pdfData } : null), [pdfData]);

  const handleDocumentLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => {
    const next = Math.min(MAX_SCALE, Math.round((scale + SCALE_STEP) * 100) / 100);
    setScale(next);
    setVisualScale(next);
  }, [scale]);
  const zoomOut = useCallback(() => {
    const next = Math.max(MIN_SCALE, Math.round((scale - SCALE_STEP) * 100) / 100);
    setScale(next);
    setVisualScale(next);
  }, [scale]);
  const zoomReset = useCallback(() => {
    setScale(1.0);
    setVisualScale(1.0);
  }, []);

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
      const container = containerRef.current;

      if (container && finalScale !== scale) {
        const ratio = finalScale / scale;
        const containerRect = container.getBoundingClientRect();
        const pointer = pointerPosRef.current;
        const pointerOffsetX = pointer ? pointer.clientX - containerRect.left : container.clientWidth / 2;
        const pointerOffsetY = pointer ? pointer.clientY - containerRect.top : container.clientHeight / 2;
        const fractionX =
          container.scrollWidth > container.clientWidth
            ? (container.scrollLeft + pointerOffsetX) / container.scrollWidth
            : 0.5;
        const fractionY =
          container.scrollHeight > container.clientHeight
            ? (container.scrollTop + pointerOffsetY) / container.scrollHeight
            : 0.5;
        pendingScrollRef.current = {
          fractionX,
          fractionY,
          expectedWidth: container.scrollWidth * ratio,
          expectedHeight: container.scrollHeight * ratio,
          pointerOffsetX,
          pointerOffsetY,
        };
      }

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
  }, [scale]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: must fire when scale changes
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    const container = containerRef.current;
    const content = contentRef.current;
    if (!pending || !container || !content) return;
    pendingScrollRef.current = null;

    content.style.minWidth = `${pending.expectedWidth}px`;
    content.style.minHeight = `${pending.expectedHeight}px`;
    content.style.transform = '';
    content.style.transformOrigin = '';

    const offsetX = pending.pointerOffsetX ?? container.clientWidth / 2;
    const offsetY = pending.pointerOffsetY ?? container.clientHeight / 2;
    container.scrollLeft = Math.max(0, pending.fractionX * pending.expectedWidth - offsetX);
    container.scrollTop = Math.max(0, pending.fractionY * pending.expectedHeight - offsetY);
  }, [scale]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: paired with useLayoutEffect above
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.style.minWidth = '';
    content.style.minHeight = '';
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
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
        <div ref={contentRef} style={{ willChange: 'transform' }}>
          <Document
            file={file}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={(err) => setError(err.message)}
            loading={null}
            imageResourcesPath="/pdfjs-images/"
          >
            {Array.from({ length: numPages }, (_, index) => (
              <PdfPage
                key={`page-${index + 1}`}
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
          </Document>
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
