import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addHighlightAnnotation,
  addStickyNoteAnnotation,
  listAnnotations,
  removeAnnotation,
} from '../services/pdf-annotator';

let pdfPath: string;

async function createMinimalPdf(): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([612, 792]); // standard letter size
  const bytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, bytes);
}

beforeEach(async () => {
  pdfPath = path.join(os.tmpdir(), `papershelf-annot-test-${Date.now()}.pdf`);
  await createMinimalPdf();
});

afterEach(() => {
  try {
    fs.unlinkSync(pdfPath);
  } catch {}
});

async function getAnnotations(filePath: string, pageIndex: number): Promise<PDFDict[]> {
  const bytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPages()[pageIndex];
  const annots = page.node.lookup(PDFName.of('Annots'));
  if (!(annots instanceof PDFArray)) return [];

  const result: PDFDict[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    const dict = pdfDoc.context.lookup(ref);
    if (dict instanceof PDFDict) result.push(dict);
  }
  return result;
}

describe('addHighlightAnnotation', () => {
  it('adds a highlight annotation with correct properties', async () => {
    // QuadPoints: 8 numbers defining a rectangle (x1,y1, x2,y2, x3,y3, x4,y4)
    const quadPoints = [100, 700, 200, 700, 100, 710, 200, 710];
    const name = await addHighlightAnnotation(pdfPath, 0, quadPoints, '#FFEB3B');

    expect(name).toMatch(/^papershelf-/);

    const annotations = await getAnnotations(pdfPath, 0);
    expect(annotations).toHaveLength(1);

    const annot = annotations[0];
    expect(annot.get(PDFName.of('Subtype'))).toBe(PDFName.of('Highlight'));

    const nmEntry = annot.get(PDFName.of('NM'));
    expect(nmEntry).toBeInstanceOf(PDFString);
    expect((nmEntry as PDFString).decodeText()).toBe(name);
  });

  it('adds multiple highlights to the same page', async () => {
    await addHighlightAnnotation(pdfPath, 0, [100, 700, 200, 700, 100, 710, 200, 710], '#FFEB3B');
    await addHighlightAnnotation(pdfPath, 0, [100, 600, 200, 600, 100, 610, 200, 610], '#4CAF50');

    const annotations = await getAnnotations(pdfPath, 0);
    expect(annotations).toHaveLength(2);
  });

  it('throws on invalid page index', async () => {
    await expect(
      addHighlightAnnotation(pdfPath, 5, [100, 700, 200, 700, 100, 710, 200, 710], '#FFEB3B'),
    ).rejects.toThrow('Page index 5 out of range');
  });
});

describe('addStickyNoteAnnotation', () => {
  it('adds a sticky note with correct contents', async () => {
    const name = await addStickyNoteAnnotation(pdfPath, 0, 150, 500, 'Important finding', '#FF9800');

    expect(name).toMatch(/^papershelf-/);

    const annotations = await getAnnotations(pdfPath, 0);
    expect(annotations).toHaveLength(1);

    const annot = annotations[0];
    expect(annot.get(PDFName.of('Subtype'))).toBe(PDFName.of('Text'));

    const contents = annot.get(PDFName.of('Contents'));
    expect(contents).toBeInstanceOf(PDFString);
    expect((contents as PDFString).decodeText()).toBe('Important finding');
  });

  it('throws on invalid page index', async () => {
    await expect(addStickyNoteAnnotation(pdfPath, -1, 100, 100, 'note', '#FF0000')).rejects.toThrow(
      'Page index -1 out of range',
    );
  });
});

describe('removeAnnotation', () => {
  it('removes an annotation by name', async () => {
    const name = await addHighlightAnnotation(pdfPath, 0, [100, 700, 200, 700, 100, 710, 200, 710], '#FFEB3B');

    const beforeAnnotations = await getAnnotations(pdfPath, 0);
    expect(beforeAnnotations).toHaveLength(1);

    const removed = await removeAnnotation(pdfPath, 0, name);
    expect(removed).toBe(true);

    const afterAnnotations = await getAnnotations(pdfPath, 0);
    expect(afterAnnotations).toHaveLength(0);
  });

  it('returns false when annotation name not found', async () => {
    const removed = await removeAnnotation(pdfPath, 0, 'nonexistent-name');
    expect(removed).toBe(false);
  });

  it('removes only the targeted annotation when multiple exist', async () => {
    const name1 = await addHighlightAnnotation(pdfPath, 0, [100, 700, 200, 700, 100, 710, 200, 710], '#FFEB3B');
    const name2 = await addStickyNoteAnnotation(pdfPath, 0, 150, 500, 'Keep this', '#FF9800');

    await removeAnnotation(pdfPath, 0, name1);

    const annotations = await getAnnotations(pdfPath, 0);
    expect(annotations).toHaveLength(1);
    const remaining = annotations[0].get(PDFName.of('NM'));
    expect(remaining).toBeInstanceOf(PDFString);
    expect((remaining as PDFString).decodeText()).toBe(name2);
  });

  it('throws on invalid page index', async () => {
    await expect(removeAnnotation(pdfPath, 10, 'any-name')).rejects.toThrow('Page index 10 out of range');
  });
});

describe('listAnnotations', () => {
  it('returns empty array for page with no annotations', async () => {
    const entries = await listAnnotations(pdfPath, 0);
    expect(entries).toHaveLength(0);
  });

  it('lists highlight annotations with correct metadata', async () => {
    const quadPoints = [100, 700, 200, 700, 100, 710, 200, 710];
    const name = await addHighlightAnnotation(pdfPath, 0, quadPoints, '#FFEB3B');

    const entries = await listAnnotations(pdfPath, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0].nm).toBe(name);
    expect(entries[0].subtype).toBe('Highlight');
    expect(entries[0].rect).toHaveLength(4);
  });

  it('lists sticky note annotations with contents', async () => {
    const name = await addStickyNoteAnnotation(pdfPath, 0, 150, 500, 'Test note', '#FF9800');

    const entries = await listAnnotations(pdfPath, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0].nm).toBe(name);
    expect(entries[0].subtype).toBe('Text');
    expect(entries[0].contents).toBe('Test note');
  });

  it('lists multiple annotations', async () => {
    await addHighlightAnnotation(pdfPath, 0, [100, 700, 200, 700, 100, 710, 200, 710], '#FFEB3B');
    await addStickyNoteAnnotation(pdfPath, 0, 150, 500, 'Note', '#FF9800');

    const entries = await listAnnotations(pdfPath, 0);
    expect(entries).toHaveLength(2);
  });

  it('returns empty for invalid page index', async () => {
    const entries = await listAnnotations(pdfPath, 99);
    expect(entries).toHaveLength(0);
  });
});

describe('file handling', () => {
  it('throws when file does not exist', async () => {
    await expect(
      addHighlightAnnotation('/nonexistent/file.pdf', 0, [0, 0, 1, 0, 0, 1, 1, 1], '#FFEB3B'),
    ).rejects.toThrow();
  });
});
