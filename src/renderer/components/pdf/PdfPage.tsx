import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { useCallback, useEffect, useRef } from 'react';
import { createAnnotationLayer, createTextLayer, renderPageCanvas } from './pdf-rendering';

type AnnotationMode = 'read' | 'highlight' | 'note';

interface PageDimensions {
  width: number;
  height: number;
}

interface AnnotationInfo {
  nm: string;
  rect: number[];
  subtype: string;
}

interface PdfPageProps {
  page: PDFPageProxy;
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
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left);
  const merged: DOMRect[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    const verticalOverlap = current.top < last.bottom - 1 && current.bottom > last.top + 1;
    const horizontalOverlap = current.left < last.right + 1;

    if (verticalOverlap && horizontalOverlap) {
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
    const pdfTop = pageDimensions.height - relTop;
    const pdfBottom = pageDimensions.height - relBottom;
    quadPoints.push(relLeft, pdfTop, relRight, pdfTop, relLeft, pdfBottom, relRight, pdfBottom);
  }
  return quadPoints;
}

export function PdfPage({
  page,
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
}: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const annotationLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const currentScaleRef = useRef<number | null>(null);

  // Report page dimensions on mount
  useEffect(() => {
    const viewport = page.getViewport({ scale: 1.0 });
    onPageLoaded(pageNumber, { width: viewport.width, height: viewport.height });
  }, [page, pageNumber, onPageLoaded]);

  // Load annotation metadata (NM values) for deletion mapping
  // biome-ignore lint/correctness/useExhaustiveDependencies: pdfVersion intentionally triggers reload
  useEffect(() => {
    const pageIndex = pageNumber - 1;
    window.electronAPI.listAnnotations(paperId, pageIndex).then((entries) => {
      for (const entry of entries) {
        const rectKey = `${pageIndex}:${entry.rect.map((n: number) => n.toFixed(1)).join(',')}`;
        annotationMap.current.set(rectKey, { nm: entry.nm, rect: entry.rect, subtype: entry.subtype });
      }
    });
  }, [paperId, pageNumber, annotationMap, pdfVersion]);

  // Initial render + re-render on scale change (double-buffered)
  // biome-ignore lint/correctness/useExhaustiveDependencies: pdfVersion triggers annotation layer rebuild
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const viewport = page.getViewport({ scale });

    // Create off-screen canvas
    const newCanvas = document.createElement('canvas');

    const renderTask = renderPageCanvas(page, viewport, newCanvas);
    renderTaskRef.current = renderTask;

    renderTask.promise
      .then(async () => {
        // Check this render wasn't cancelled
        if (renderTaskRef.current !== renderTask) return;
        renderTaskRef.current = null;

        // Atomic swap: replace old canvas with new one
        const oldCanvas = canvasRef.current;
        if (oldCanvas && wrapper.contains(oldCanvas)) {
          wrapper.replaceChild(newCanvas, oldCanvas);
        } else {
          // First render or canvas was removed — insert before text layer
          const textDiv = textLayerRef.current;
          if (textDiv) {
            wrapper.insertBefore(newCanvas, textDiv);
          } else {
            wrapper.insertBefore(newCanvas, wrapper.firstChild);
          }
        }
        canvasRef.current = newCanvas;
        currentScaleRef.current = scale;

        // Clean up bridge styles set by PdfViewer's useLayoutEffect
        wrapper.style.width = 'fit-content';
        wrapper.style.height = '';
        wrapper.style.overflow = '';

        // Clear content div min dimensions (set as scroll anchor during zoom)
        const contentDiv = wrapper.parentElement;
        if (contentDiv) {
          contentDiv.style.minWidth = '';
          contentDiv.style.minHeight = '';
        }

        // Set data attributes for coordinate conversion
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        wrapper.setAttribute('data-pdf-width', String(unscaledViewport.width));
        wrapper.setAttribute('data-pdf-height', String(unscaledViewport.height));

        // Rebuild text layer
        let textDiv = textLayerRef.current;
        if (!textDiv) {
          textDiv = document.createElement('div');
          textLayerRef.current = textDiv;
          wrapper.appendChild(textDiv);
        }
        await createTextLayer(page, viewport, textDiv);

        // Rebuild annotation layer
        let annotDiv = annotationLayerRef.current;
        if (!annotDiv) {
          annotDiv = document.createElement('div');
          annotationLayerRef.current = annotDiv;
          wrapper.appendChild(annotDiv);
        }
        await createAnnotationLayer(page, viewport, annotDiv);
      })
      .catch((err) => {
        // RenderingCancelledException is expected when scale changes mid-render
        if (err?.name !== 'RenderingCancelledException') {
          console.error('PDF page render error:', err);
        }
      });

    return () => {
      if (renderTaskRef.current === renderTask) {
        renderTask.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [page, scale, pdfVersion]);

  // Cleanup on unmount — only cancel render, don't touch DOM (React handles that)
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, []);

  const handleMouseUp = useCallback(
    (_event: React.MouseEvent) => {
      if (annotationMode !== 'highlight') return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;

      const pageEl = wrapperRef.current;
      if (!pageEl) return;

      const range = selection.getRangeAt(0);
      if (!pageEl.contains(range.commonAncestorContainer)) return;

      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (rects.length === 0) return;

      const widthAttr = pageEl.getAttribute('data-pdf-width');
      const heightAttr = pageEl.getAttribute('data-pdf-height');
      if (!widthAttr || !heightAttr) return;

      const pageDimensions = { width: Number.parseFloat(widthAttr), height: Number.parseFloat(heightAttr) };
      const quadPoints = selectionRectsToQuadPoints(rects, pageEl, scale, pageDimensions);

      const lastRect = rects[rects.length - 1];
      onTextSelected(pageNumber - 1, quadPoints, lastRect.right, lastRect.bottom);
    },
    [annotationMode, scale, pageNumber, onTextSelected],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      // Check for annotation click (works in any mode)
      const target = event.target as HTMLElement;
      const annotationSection = target.closest('.annotationLayer section') as HTMLElement | null;
      if (annotationSection) {
        const pageEl = wrapperRef.current;
        if (pageEl) {
          const pageIndex = pageNumber - 1;
          const sectionRect = annotationSection.getBoundingClientRect();
          const pageRect = pageEl.getBoundingClientRect();

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

      const pageEl = wrapperRef.current;
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
      ref={wrapperRef}
      className={`relative mx-auto my-4 ${annotationMode === 'highlight' ? 'annotate-highlight-mode' : ''}`}
      style={{ width: 'fit-content', cursor: annotationMode === 'note' ? 'crosshair' : undefined }}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    />
  );
}
