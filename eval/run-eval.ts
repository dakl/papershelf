/**
 * Search quality evaluation orchestrator.
 *
 * Phases: seed → embed → search → report
 *
 * Seeds a temp SQLite DB with golden-set papers, chunks and embeds them
 * using the real pipeline, runs search in keyword/semantic/hybrid modes
 * for each query, and computes IR metrics (MRR, nDCG@10, P@5, P@10).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initDatabase, closeDatabase } from '../src/main/db/connection';
import { insertPaper } from '../src/main/db/papers';
import { getDb } from '../src/main/db/connection';
import { setEmbeddingStatus } from '../src/main/db/vector-store';
import { hybridSearch } from '../src/main/db/hybrid-search';
import { chunkPaper } from '../src/main/services/chunker';
import { createEmbedder } from './embed-helper';
import { computeMRR, computeNDCG, computePrecisionAtK } from './metrics';
import type { GoldenSet, QueryEvalResult, EvalOutput, ModeEvalOutput, SearchMode } from './types';

const MRR_THRESHOLD = 0.3;
const NDCG_THRESHOLD = 0.3;
const SEARCH_MODES: SearchMode[] = ['keyword', 'semantic', 'hybrid'];

// FTS5 treats hyphens as NOT and other chars as operators.
// Quote each token so FTS5 treats them as literals.
function sanitizeFtsQuery(query: string): string {
  return query
    .split(/\s+/)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(' ');
}

function computeAggregated(queryResults: QueryEvalResult[]) {
  const n = queryResults.length;
  return {
    meanMRR: queryResults.reduce((sum, q) => sum + q.mrr, 0) / n,
    meanNDCG10: queryResults.reduce((sum, q) => sum + q.ndcgAt10, 0) / n,
    meanP5: queryResults.reduce((sum, q) => sum + q.precisionAt5, 0) / n,
    meanP10: queryResults.reduce((sum, q) => sum + q.precisionAt10, 0) / n,
  };
}

// Dummy zero embedding for keyword-only mode (vector results will be empty)
const EMBEDDING_DIM = 384;
const ZERO_EMBEDDING = new Float32Array(EMBEDDING_DIM);

async function main(): Promise<void> {
  const goldenSet: GoldenSet = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'golden-set.json'), 'utf-8'),
  );

  // --- Phase 1: Seed ---
  console.log(`Seeding ${goldenSet.papers.length} papers...`);
  const tmpDbPath = path.join(os.tmpdir(), `papershelf-eval-${Date.now()}.db`);
  initDatabase(tmpDbPath);
  const db = getDb();

  const arxivIdToPaperId = new Map<string, string>();

  for (const paper of goldenSet.papers) {
    const inserted = insertPaper({
      arxivId: paper.arxivId,
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      publishedDate: paper.publishedDate,
      updatedDate: paper.publishedDate,
      categories: paper.categories,
      arxivUrl: `https://arxiv.org/abs/${paper.arxivId}`,
      pdfUrl: `https://arxiv.org/pdf/${paper.arxivId}`,
      pdfPath: null,
      fullText: paper.bodyExcerpt,
    });
    arxivIdToPaperId.set(paper.arxivId, inserted.id);

    // Chunk the paper
    const chunks = chunkPaper(paper.title, paper.abstract, paper.bodyExcerpt);
    for (const chunk of chunks) {
      db.prepare(`
        INSERT INTO paper_chunks (id, paper_id, chunk_type, chunk_index, chunk_text, token_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        inserted.id,
        chunk.chunkType,
        chunk.chunkIndex,
        chunk.text,
        chunk.estimatedTokens,
      );
    }

    setEmbeddingStatus(db, inserted.id, 'indexing', undefined, chunks.length);
  }

  // --- Phase 2: Embed ---
  console.log('Loading embedding model...');
  const cacheDir = process.env.HF_HOME || path.join(os.homedir(), '.cache', 'huggingface');
  const embedder = await createEmbedder(cacheDir);

  console.log('Embedding chunks...');
  const allChunks = db
    .prepare('SELECT id, chunk_text FROM paper_chunks WHERE embedding IS NULL')
    .all() as { id: string; chunk_text: string }[];

  const chunkTexts = allChunks.map((c) => c.chunk_text);
  const embeddings = await embedder.embedDocuments(chunkTexts);

  const updateStmt = db.prepare('UPDATE paper_chunks SET embedding = ? WHERE id = ?');
  const updateTransaction = db.transaction(() => {
    for (let i = 0; i < allChunks.length; i++) {
      const embeddingBlob = Buffer.from(
        embeddings[i].buffer,
        embeddings[i].byteOffset,
        embeddings[i].byteLength,
      );
      updateStmt.run(embeddingBlob, allChunks[i].id);
    }
  });
  updateTransaction();

  // Mark all papers as complete
  for (const [, paperId] of arxivIdToPaperId) {
    setEmbeddingStatus(db, paperId, 'complete');
  }
  console.log(`Embedded ${allChunks.length} chunks.`);

  // --- Phase 3: Search (all modes) ---
  // Pre-compute query embeddings (shared across modes)
  console.log(`Computing embeddings for ${goldenSet.queries.length} queries...`);
  const queryEmbeddings = new Map<string, Float32Array>();
  for (const goldenQuery of goldenSet.queries) {
    queryEmbeddings.set(goldenQuery.id, await embedder.embedQuery(goldenQuery.query));
  }

  const modeOutputs: ModeEvalOutput[] = [];

  for (const mode of SEARCH_MODES) {
    console.log(`\nRunning ${goldenSet.queries.length} queries in ${mode} mode...`);
    const queryResults: QueryEvalResult[] = [];

    for (const goldenQuery of goldenSet.queries) {
      const queryEmbedding = mode === 'keyword' ? ZERO_EMBEDDING : queryEmbeddings.get(goldenQuery.id)!;
      const ftsQuery = sanitizeFtsQuery(goldenQuery.query);
      const results = hybridSearch(ftsQuery, queryEmbedding, 10, { mode });

      // Build judgment lookup: arxivId → relevance
      const judgmentMap = new Map<string, number>();
      for (const judgment of goldenQuery.judgments) {
        judgmentMap.set(judgment.paperId, judgment.relevance);
      }

      const relevances: number[] = results.map((result) => {
        const arxivId = result.paper.arxivId;
        return arxivId ? (judgmentMap.get(arxivId) ?? 0) : 0;
      });

      const rankedResults = results.map((result) => ({
        arxivId: result.paper.arxivId,
        title: result.paper.title,
        score: result.score,
        matchType: result.matchType,
      }));

      queryResults.push({
        queryId: goldenQuery.id,
        query: goldenQuery.query,
        mrr: computeMRR(relevances),
        ndcgAt10: computeNDCG(relevances, 10),
        precisionAt5: computePrecisionAtK(relevances, 5),
        precisionAt10: computePrecisionAtK(relevances, 10),
        rankedResults,
      });
    }

    modeOutputs.push({
      mode,
      aggregated: computeAggregated(queryResults),
      queries: queryResults,
    });
  }

  // --- Phase 4: Report ---
  const evalOutput: EvalOutput = { modes: modeOutputs };
  fs.writeFileSync('/tmp/eval-results.json', JSON.stringify(evalOutput, null, 2));

  // Build markdown report
  const lines: string[] = [
    '## Search Quality Evaluation',
    '',
    '### Mode Comparison',
    '| Metric | Keyword | Semantic | Hybrid |',
    '|--------|---------|----------|--------|',
  ];

  const byMode = new Map(modeOutputs.map((m) => [m.mode, m.aggregated]));
  const kw = byMode.get('keyword')!;
  const sem = byMode.get('semantic')!;
  const hyb = byMode.get('hybrid')!;

  lines.push(`| Mean MRR | ${kw.meanMRR.toFixed(3)} | ${sem.meanMRR.toFixed(3)} | ${hyb.meanMRR.toFixed(3)} |`);
  lines.push(`| Mean nDCG@10 | ${kw.meanNDCG10.toFixed(3)} | ${sem.meanNDCG10.toFixed(3)} | ${hyb.meanNDCG10.toFixed(3)} |`);
  lines.push(`| Mean P@5 | ${kw.meanP5.toFixed(3)} | ${sem.meanP5.toFixed(3)} | ${hyb.meanP5.toFixed(3)} |`);
  lines.push(`| Mean P@10 | ${kw.meanP10.toFixed(3)} | ${sem.meanP10.toFixed(3)} | ${hyb.meanP10.toFixed(3)} |`);

  for (const modeOutput of modeOutputs) {
    lines.push('');
    lines.push(`### Per-Query Results (${modeOutput.mode.charAt(0).toUpperCase() + modeOutput.mode.slice(1)})`);
    lines.push('| Query | MRR | nDCG@10 | P@5 | Top Result |');
    lines.push('|-------|-----|---------|-----|------------|');
    for (const result of modeOutput.queries) {
      const topResult = result.rankedResults[0]?.title ?? '(none)';
      lines.push(
        `| ${result.query} | ${result.mrr.toFixed(2)} | ${result.ndcgAt10.toFixed(2)} | ${result.precisionAt5.toFixed(2)} | ${topResult} |`,
      );
    }
  }

  const markdown = lines.join('\n');
  fs.writeFileSync('/tmp/eval-summary.md', markdown);
  console.log(markdown);

  // Cleanup
  closeDatabase();
  try {
    fs.unlinkSync(tmpDbPath);
    fs.unlinkSync(`${tmpDbPath}-wal`);
    fs.unlinkSync(`${tmpDbPath}-shm`);
  } catch {
    // WAL/SHM files may not exist
  }

  // Threshold check applies only to hybrid mode
  if (hyb.meanMRR < MRR_THRESHOLD || hyb.meanNDCG10 < NDCG_THRESHOLD) {
    console.error(
      `\nFAILED: Hybrid Mean MRR (${hyb.meanMRR.toFixed(3)}) or nDCG@10 (${hyb.meanNDCG10.toFixed(3)}) below threshold (${MRR_THRESHOLD})`,
    );
    process.exit(1);
  }

  console.log('\nPASSED: Hybrid metrics above threshold.');
}

main().catch((err) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
