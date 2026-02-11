import crypto from 'crypto';
import fs from 'fs';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFString } from 'pdf-lib';

function generateAnnotationName(): string {
  return `papershelf-${crypto.randomUUID()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const r = Number.parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = Number.parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = Number.parseInt(cleaned.substring(4, 6), 16) / 255;
  return { r, g, b };
}

export async function addHighlightAnnotation(
  pdfPath: string,
  pageIndex: number,
  quadPoints: number[],
  color: string,
): Promise<string> {
  const fileBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(`Page index ${pageIndex} out of range (0-${pages.length - 1})`);
  }

  const page = pages[pageIndex];
  const { r, g, b } = hexToRgb(color);
  const annotationName = generateAnnotationName();

  // Build bounding rect from quadPoints (min/max of all points)
  const xCoords = quadPoints.filter((_, i) => i % 2 === 0);
  const yCoords = quadPoints.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);

  const context = pdfDoc.context;

  const quadPointsArray = PDFArray.withContext(context);
  for (const value of quadPoints) {
    quadPointsArray.push(PDFNumber.of(value));
  }

  const colorArray = PDFArray.withContext(context);
  colorArray.push(PDFNumber.of(r));
  colorArray.push(PDFNumber.of(g));
  colorArray.push(PDFNumber.of(b));

  const rectArray = PDFArray.withContext(context);
  rectArray.push(PDFNumber.of(minX));
  rectArray.push(PDFNumber.of(minY));
  rectArray.push(PDFNumber.of(maxX));
  rectArray.push(PDFNumber.of(maxY));

  const annotDict = context.obj({});
  const dict = annotDict as PDFDict;
  dict.set(PDFName.of('Type'), PDFName.of('Annot'));
  dict.set(PDFName.of('Subtype'), PDFName.of('Highlight'));
  dict.set(PDFName.of('Rect'), rectArray);
  dict.set(PDFName.of('QuadPoints'), quadPointsArray);
  dict.set(PDFName.of('C'), colorArray);
  dict.set(PDFName.of('NM'), PDFString.of(annotationName));
  dict.set(PDFName.of('F'), PDFNumber.of(4)); // Print flag

  const annotRef = context.register(dict);

  const existingAnnots = page.node.lookup(PDFName.of('Annots'));
  let annotsArray: PDFArray;
  if (existingAnnots instanceof PDFArray) {
    annotsArray = existingAnnots;
  } else {
    annotsArray = PDFArray.withContext(context);
    page.node.set(PDFName.of('Annots'), annotsArray);
  }
  annotsArray.push(annotRef);

  const savedBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, savedBytes);

  return annotationName;
}

export async function addStickyNoteAnnotation(
  pdfPath: string,
  pageIndex: number,
  x: number,
  y: number,
  text: string,
  color: string,
): Promise<string> {
  const fileBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(`Page index ${pageIndex} out of range (0-${pages.length - 1})`);
  }

  const page = pages[pageIndex];
  const { r, g, b } = hexToRgb(color);
  const annotationName = generateAnnotationName();

  const context = pdfDoc.context;

  const colorArray = PDFArray.withContext(context);
  colorArray.push(PDFNumber.of(r));
  colorArray.push(PDFNumber.of(g));
  colorArray.push(PDFNumber.of(b));

  // Sticky note icons are typically 24x24 points
  const rectArray = PDFArray.withContext(context);
  rectArray.push(PDFNumber.of(x));
  rectArray.push(PDFNumber.of(y));
  rectArray.push(PDFNumber.of(x + 24));
  rectArray.push(PDFNumber.of(y + 24));

  const annotDict = context.obj({});
  const dict = annotDict as PDFDict;
  dict.set(PDFName.of('Type'), PDFName.of('Annot'));
  dict.set(PDFName.of('Subtype'), PDFName.of('Text'));
  dict.set(PDFName.of('Rect'), rectArray);
  dict.set(PDFName.of('Contents'), PDFString.of(text));
  dict.set(PDFName.of('C'), colorArray);
  dict.set(PDFName.of('NM'), PDFString.of(annotationName));
  dict.set(PDFName.of('Name'), PDFName.of('Note'));
  dict.set(PDFName.of('F'), PDFNumber.of(4)); // Print flag
  dict.set(PDFName.of('Open'), context.obj(false));

  const annotRef = context.register(dict);

  const existingAnnots = page.node.lookup(PDFName.of('Annots'));
  let annotsArray: PDFArray;
  if (existingAnnots instanceof PDFArray) {
    annotsArray = existingAnnots;
  } else {
    annotsArray = PDFArray.withContext(context);
    page.node.set(PDFName.of('Annots'), annotsArray);
  }
  annotsArray.push(annotRef);

  const savedBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, savedBytes);

  return annotationName;
}

export interface AnnotationEntry {
  nm: string;
  subtype: string;
  rect: number[];
  contents?: string;
}

export async function listAnnotations(pdfPath: string, pageIndex: number): Promise<AnnotationEntry[]> {
  const fileBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();

  if (pageIndex < 0 || pageIndex >= pages.length) {
    return [];
  }

  const page = pages[pageIndex];
  const context = pdfDoc.context;
  const existingAnnots = page.node.lookup(PDFName.of('Annots'));
  if (!(existingAnnots instanceof PDFArray)) return [];

  const entries: AnnotationEntry[] = [];
  for (let i = 0; i < existingAnnots.size(); i++) {
    const annotRef = existingAnnots.get(i);
    const annotDict = context.lookup(annotRef);
    if (!(annotDict instanceof PDFDict)) continue;

    const nmEntry = annotDict.get(PDFName.of('NM'));
    if (!(nmEntry instanceof PDFString)) continue;

    const nm = nmEntry.decodeText();
    if (!nm.startsWith('papershelf-')) continue;

    const subtypeEntry = annotDict.get(PDFName.of('Subtype'));
    const subtype = subtypeEntry instanceof PDFName ? subtypeEntry.decodeText() : '';

    const rectEntry = annotDict.lookup(PDFName.of('Rect'));
    const rect: number[] = [];
    if (rectEntry instanceof PDFArray) {
      for (let j = 0; j < rectEntry.size(); j++) {
        const val = rectEntry.get(j);
        if (val instanceof PDFNumber) rect.push(val.asNumber());
      }
    }

    const contentsEntry = annotDict.get(PDFName.of('Contents'));
    const contents = contentsEntry instanceof PDFString ? contentsEntry.decodeText() : undefined;

    entries.push({ nm, subtype, rect, contents });
  }

  return entries;
}

export async function removeAnnotation(pdfPath: string, pageIndex: number, annotationName: string): Promise<boolean> {
  const fileBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(`Page index ${pageIndex} out of range (0-${pages.length - 1})`);
  }

  const page = pages[pageIndex];
  const context = pdfDoc.context;

  const existingAnnots = page.node.lookup(PDFName.of('Annots'));
  if (!(existingAnnots instanceof PDFArray)) {
    return false;
  }

  let foundIndex = -1;
  for (let i = 0; i < existingAnnots.size(); i++) {
    const annotRef = existingAnnots.get(i);
    const annotDict = context.lookup(annotRef);
    if (annotDict instanceof PDFDict) {
      const nameEntry = annotDict.get(PDFName.of('NM'));
      if (nameEntry instanceof PDFString && nameEntry.decodeText() === annotationName) {
        foundIndex = i;
        break;
      }
    }
  }

  if (foundIndex === -1) {
    return false;
  }

  existingAnnots.remove(foundIndex);

  const savedBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, savedBytes);

  return true;
}
