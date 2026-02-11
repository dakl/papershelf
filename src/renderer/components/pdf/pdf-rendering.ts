import { AnnotationLayer, type PageViewport, type PDFPageProxy, setLayerDimensions, TextLayer } from 'pdfjs-dist';

/**
 * Minimal no-op link service for AnnotationLayer. We don't need navigation.
 */
const linkService = {
  pagesCount: 0,
  page: 0,
  rotation: 0,
  isInPresentationMode: false,
  externalLinkEnabled: true,
  goToDestination: async () => {},
  goToPage: () => {},
  addLinkAttributes: () => {},
  getDestinationHash: () => '#',
  getAnchorUrl: () => '#',
  setHash: () => {},
  executeNamedAction: () => {},
  executeSetOCGState: () => {},
};

/**
 * Render a PDF page to a canvas element, handling HiDPI via devicePixelRatio.
 * Returns the RenderTask so the caller can cancel it.
 */
export function renderPageCanvas(page: PDFPageProxy, viewport: PageViewport, canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return page.render({ canvasContext: ctx, viewport });
}

/**
 * Create a pdfjs-dist TextLayer for text selection.
 */
export async function createTextLayer(page: PDFPageProxy, viewport: PageViewport, container: HTMLDivElement) {
  container.innerHTML = '';
  container.className = 'textLayer';
  container.style.setProperty('--scale-factor', String(viewport.scale));
  setLayerDimensions(container, viewport);

  const textContent = await page.getTextContent();
  const textLayer = new TextLayer({
    textContentSource: textContent,
    container,
    viewport,
  });
  await textLayer.render();
  return textLayer;
}

/**
 * Create a pdfjs-dist AnnotationLayer for displaying PDF annotations.
 */
export async function createAnnotationLayer(page: PDFPageProxy, viewport: PageViewport, container: HTMLDivElement) {
  container.innerHTML = '';
  container.className = 'annotationLayer';
  container.style.setProperty('--scale-factor', String(viewport.scale));
  setLayerDimensions(container, viewport);

  const annotations = await page.getAnnotations({ intent: 'display' });
  const annotationLayer = new AnnotationLayer({
    div: container,
    accessibilityManager: null,
    annotationCanvasMap: null,
    annotationEditorUIManager: null,
    page,
    viewport,
    structTreeLayer: null,
  });
  await annotationLayer.render({
    viewport,
    div: container,
    annotations,
    page,
    linkService: linkService as never,
    renderForms: false,
    imageResourcesPath: '/pdfjs-images/',
  });
  return annotationLayer;
}
