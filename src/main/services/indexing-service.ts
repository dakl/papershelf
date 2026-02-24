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

/**
 * Reset any papers stuck in 'indexing' state back to 'pending'.
 * This happens when the worker crashes mid-indexing.
 */
export function resetStaleIndexingPapers(): void {
  const db = getDb();
  const stale = db.prepare("SELECT paper_id FROM embedding_status WHERE status = 'indexing'").all() as {
    paper_id: string;
  }[];

  if (stale.length > 0) {
    console.log(`[indexing-service] Resetting ${stale.length} papers stuck in 'indexing' state`);
    const reset = db.prepare(
      "UPDATE embedding_status SET status = 'pending', error_message = NULL WHERE status = 'indexing'",
    );
    reset.run();
  }
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
    console.log(`[indexing-service] Paper ${paperId}: ${chunks.length} chunks from "${paper.title.slice(0, 60)}"`);

    if (chunks.length === 0) {
      console.log(`[indexing-service] Paper ${paperId}: no chunks, marking complete`);
      setEmbeddingStatus(db, paperId, 'complete', undefined, 0);
      return;
    }

    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedDocumentTexts(chunkTexts);
    console.log(`[indexing-service] Paper ${paperId}: got ${embeddings.length} embeddings`);

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
    console.log(`[indexing-service] Paper ${paperId}: indexed successfully (${chunks.length} chunks)`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[indexing-service] Paper ${paperId}: failed — ${errorMessage}`);
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
    if (papersToIndex.length === 0) {
      console.log('[indexing-service] No papers need indexing');
      return;
    }

    console.log(`[indexing-service] Starting indexing of ${papersToIndex.length} papers`);

    for (let i = 0; i < papersToIndex.length; i++) {
      const paper = papersToIndex[i];

      console.log(
        `[indexing-service] Indexing paper ${i + 1}/${papersToIndex.length}: ${paper.id} "${paper.title.slice(0, 60)}"`,
      );

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
        console.warn(`[indexing-service] Failed to index paper ${paper.id}:`, err instanceof Error ? err.message : err);
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

    console.log(`[indexing-service] Indexing complete (${papersToIndex.length} papers processed)`);

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
    console.log(`[indexing-service] Follow-up: ${remaining.length} new papers to index`);
    indexAllPapers().catch((err) => {
      console.warn('[indexing-service] Follow-up indexing failed:', err);
    });
  }
}
