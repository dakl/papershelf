import type { ArxivPaper, LibraryPaper } from '../../shared/types';
import * as db from '../database';
import { downloadAndExtractPdf } from '../pdf-processor';

export interface SavePaperFromArxivResult {
  paper: LibraryPaper;
  alreadyExisted: boolean;
  pdfDownloaded: boolean;
  textExtracted: boolean;
}

export async function savePaperFromArxivPaper(paper: ArxivPaper): Promise<SavePaperFromArxivResult> {
  const existing = db.getPaperByArxivId(paper.id);
  if (existing) {
    return { paper: existing, alreadyExisted: true, pdfDownloaded: false, textExtracted: false };
  }

  let pdfPath: string | null = null;
  let fullText: string | null = null;

  if (paper.pdfUrl) {
    try {
      const result = await downloadAndExtractPdf(paper.pdfUrl, paper.id);
      pdfPath = result.pdfPath;
      fullText = result.fullText;
    } catch {
      // Save paper even if PDF download fails
    }
  }

  const saved = db.insertPaper({
    arxivId: paper.id,
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    publishedDate: paper.publishedDate,
    updatedDate: paper.updatedDate,
    categories: paper.categories,
    arxivUrl: paper.arxivUrl,
    pdfUrl: paper.pdfUrl,
    pdfPath,
    fullText,
  });

  return { paper: saved, alreadyExisted: false, pdfDownloaded: pdfPath !== null, textExtracted: fullText !== null };
}
