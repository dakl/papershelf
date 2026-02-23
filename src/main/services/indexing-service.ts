import { getDb } from '../db/connection';
import {
  deleteChunksForPaper,
  getPapersNeedingEmbedding,
  insertChunkWithEmbedding,
  setEmbeddingStatus,
} from '../db/vector-store';
import { DataChangeEvent, eventEmitter } from '../event-emitter';
import { chunkPaper } from './chunker';
import { embedDocumentTexts } from './embedding-service';

let indexingInProgress = false;

export function isIndexingInProgress(): boolean {
  return indexingInProgress;
}

export async function indexPaper(paperId: string): Promise<void> {
  const db = getDb();

  const paper = db.prepare('SELECT id, title, abstract, full_text FROM papers WHERE id = ?').get(paperId) as
    | { id: string; title: string; abstract: string; full_text: string | null }
    | undefined;

  if (!paper) return;

  try {
    setEmbeddingStatus(db, paperId, 'indexing');

    // Delete existing chunks for re-indexing
    deleteChunksForPaper(db, paperId);

    const chunks = chunkPaper(paper.title, paper.abstract, paper.full_text);

    if (chunks.length === 0) {
      setEmbeddingStatus(db, paperId, 'complete', undefined, 0);
      return;
    }

    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedDocumentTexts(chunkTexts);

    // Insert all chunks + embeddings in a transaction
    const insertAll = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        insertChunkWithEmbedding(
          db,
          {
            paperId,
            chunkType: chunks[i].chunkType,
            chunkIndex: chunks[i].chunkIndex,
            chunkText: chunks[i].text,
            tokenCount: chunks[i].estimatedTokens,
          },
          embeddings[i],
        );
      }
    });

    insertAll();
    setEmbeddingStatus(db, paperId, 'complete', undefined, chunks.length);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    setEmbeddingStatus(db, paperId, 'failed', errorMessage);
    throw err;
  }
}

export async function indexAllPapers(): Promise<void> {
  if (indexingInProgress) return;

  indexingInProgress = true;
  const db = getDb();

  try {
    const papersToIndex = getPapersNeedingEmbedding(db);
    if (papersToIndex.length === 0) return;

    for (let i = 0; i < papersToIndex.length; i++) {
      const paper = papersToIndex[i];

      eventEmitter.emit(DataChangeEvent.INDEXING_PROGRESS, {
        paperId: paper.id,
        paperTitle: paper.title,
        current: i + 1,
        total: papersToIndex.length,
        status: 'indexing',
      });

      try {
        await indexPaper(paper.id);
        eventEmitter.emit(DataChangeEvent.INDEXING_PROGRESS, {
          paperId: paper.id,
          paperTitle: paper.title,
          current: i + 1,
          total: papersToIndex.length,
          status: 'indexed',
        });
      } catch (err) {
        console.warn(`Failed to index paper ${paper.id}:`, err instanceof Error ? err.message : err);
        eventEmitter.emit(DataChangeEvent.INDEXING_PROGRESS, {
          paperId: paper.id,
          paperTitle: paper.title,
          current: i + 1,
          total: papersToIndex.length,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        // Continue with next paper
      }
    }

    eventEmitter.emit(DataChangeEvent.INDEXING_PROGRESS, {
      paperId: '',
      paperTitle: '',
      current: papersToIndex.length,
      total: papersToIndex.length,
      status: 'complete',
    });
  } finally {
    indexingInProgress = false;
  }

  // Papers may have been added while we were indexing — pick them up.
  // Only check for pending (new) papers, not failed ones (those need explicit re-index).
  const remaining = db
    .prepare(
      `SELECT p.id FROM papers p
       LEFT JOIN embedding_status es ON p.id = es.paper_id
       WHERE es.paper_id IS NULL OR es.status = 'pending'`,
    )
    .all();
  if (remaining.length > 0) {
    indexAllPapers().catch((err) => {
      console.warn('Follow-up indexing failed:', err);
    });
  }
}
