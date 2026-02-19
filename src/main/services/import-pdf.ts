import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ImportBatchResult, LibraryPaper } from '../../shared/types';
import { insertPaper } from '../db/papers';
import { DataChangeEvent, eventEmitter } from '../event-emitter';
import { extractText, getPapersDir } from '../pdf-processor';

function titleFromFilename(filename: string): string {
  return path.basename(filename, '.pdf').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function importLocalPdfs(filePaths: string[]): Promise<ImportBatchResult> {
  const imported: LibraryPaper[] = [];
  const failed: { filename: string; error: string }[] = [];
  const papersDir = getPapersDir();

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const originalFilename = path.basename(filePath);
    eventEmitter.emit(DataChangeEvent.IMPORT_PROGRESS, {
      current: i + 1,
      total: filePaths.length,
      filename: originalFilename,
    });
    try {
      const buffer = fs.readFileSync(filePath);
      const destFilename = `${crypto.randomUUID()}.pdf`;
      const destPath = path.join(papersDir, destFilename);
      fs.writeFileSync(destPath, buffer);

      let fullText: string | null = null;
      try {
        fullText = await extractText(buffer);
      } catch {
        // Text extraction failure is non-blocking
      }

      const title = titleFromFilename(originalFilename);
      const now = new Date().toISOString();

      const paper = insertPaper({
        arxivId: null,
        doi: null,
        source: 'local',
        title,
        authors: [],
        abstract: '',
        publishedDate: now,
        updatedDate: now,
        categories: [],
        arxivUrl: '',
        pdfUrl: '',
        pdfPath: destPath,
        fullText,
      });

      imported.push(paper);
    } catch (err) {
      failed.push({
        filename: originalFilename,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { imported, failed, totalCount: filePaths.length };
}
