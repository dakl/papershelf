import fs from 'fs';
import { getPaperById } from '../database';

export function readPdfForPaper(paperId: string): Buffer | null {
  const paper = getPaperById(paperId);
  if (!paper?.pdfPath) return null;
  try {
    return fs.readFileSync(paper.pdfPath);
  } catch {
    return null;
  }
}
