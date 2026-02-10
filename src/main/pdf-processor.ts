import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths';

function getPapersDir(): string {
  const dir = path.join(getDataDir(), 'papers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function sanitizeFilename(id: string): string {
  return id.replace(/[/\\:*?"<>|]/g, '_');
}

export async function downloadAndExtractPdf(
  pdfUrl: string,
  arxivId: string,
): Promise<{ pdfPath: string; fullText: string | null }> {
  const papersDir = getPapersDir();
  const filename = `${sanitizeFilename(arxivId)}.pdf`;
  const pdfPath = path.join(papersDir, filename);

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(pdfPath, buffer);

  let fullText: string | null = null;
  try {
    // Dynamic import to avoid DOMMatrix polyfill crash at module load time
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    fullText = result.text || null;
    await parser.destroy();
  } catch {
    // PDF text extraction failed — save without full text
  }

  return { pdfPath, fullText };
}
