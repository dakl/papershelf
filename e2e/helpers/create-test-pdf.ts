import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generate a minimal test PDF with searchable text content.
 * Returns the path to the generated file.
 */
export async function createTestPdf(dir: string, filename = 'test-paper.pdf'): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]); // US Letter

  const lines = [
    'Attention Is All You Need',
    '',
    'Abstract',
    '',
    'The dominant sequence transduction models are based on complex recurrent',
    'or convolutional neural networks that include an encoder and a decoder.',
    'The best performing models also connect the encoder and decoder through',
    'an attention mechanism. We propose a new simple network architecture,',
    'the Transformer, based solely on attention mechanisms, dispensing with',
    'recurrence and convolutions entirely.',
  ];

  let y = 720;
  for (const line of lines) {
    const size = line === lines[0] ? 18 : 11;
    page.drawText(line, {
      x: 72,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    y -= size + 6;
  }

  const pdfBytes = await doc.save();
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, pdfBytes);
  return filePath;
}
