import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths';
import { getPdfLibraryPath } from './settings';

export function getPapersDir(): string {
  const customPath = getPdfLibraryPath();
  const dir = customPath || path.join(getDataDir(), 'papers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getDefaultPapersDir(): string {
  const dir = path.join(getDataDir(), 'papers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getCacheDir(): string {
  const dir = path.join(getDataDir(), 'pdf-cache');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function sanitizeFilename(id: string): string {
  return id.replace(/[/\\:*?"<>|]/g, '_');
}

function getCachePath(arxivId: string): string {
  return path.join(getCacheDir(), `${sanitizeFilename(arxivId)}.pdf`);
}

export async function extractText(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const text = result.text || null;
    await parser.destroy();
    return text;
  } catch {
    return null;
  }
}

/** Fetch a PDF by URL and cache it locally. Returns the buffer for immediate display. */
export async function fetchAndCachePdf(pdfUrl: string, arxivId: string): Promise<Buffer> {
  const cachePath = getCachePath(arxivId);

  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath);
  }

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(cachePath, buffer);
  return buffer;
}

/** Move a cached PDF to the papers directory and extract text. */
export async function promoteCachedPdf(arxivId: string): Promise<{ pdfPath: string; fullText: string | null }> {
  const cachePath = getCachePath(arxivId);
  const papersDir = getPapersDir();
  const filename = `${sanitizeFilename(arxivId)}.pdf`;
  const pdfPath = path.join(papersDir, filename);

  if (fs.existsSync(cachePath)) {
    fs.renameSync(cachePath, pdfPath);
  } else {
    throw new Error('Cached PDF not found');
  }

  const buffer = fs.readFileSync(pdfPath);
  const fullText = await extractText(buffer);
  return { pdfPath, fullText };
}

export async function downloadAndExtractPdf(
  pdfUrl: string,
  arxivId: string,
): Promise<{ pdfPath: string; fullText: string | null }> {
  const papersDir = getPapersDir();
  const filename = `${sanitizeFilename(arxivId)}.pdf`;
  const pdfPath = path.join(papersDir, filename);

  // Check cache first
  const cachePath = getCachePath(arxivId);
  if (fs.existsSync(cachePath)) {
    fs.renameSync(cachePath, pdfPath);
    const buffer = fs.readFileSync(pdfPath);
    const fullText = await extractText(buffer);
    return { pdfPath, fullText };
  }

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(pdfPath, buffer);
  const fullText = await extractText(buffer);
  return { pdfPath, fullText };
}
