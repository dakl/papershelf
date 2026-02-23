/**
 * Standalone Node.js child process for running embedding inference.
 *
 * Spawned via child_process.fork() with the system Node binary to avoid
 * SIGTRAP crashes from onnxruntime-node inside Electron's main process.
 */

const MODEL_ID = 'nomic-ai/nomic-embed-text-v1.5';
const EMBEDDING_DIMS = 256;
const SEARCH_PREFIX = 'search_query: ';
const DOCUMENT_PREFIX = 'search_document: ';

// biome-ignore lint/suspicious/noExplicitAny: pipeline type from dynamic import
let pipeline: any = null;
let cacheDir: string | null = null;

function truncateAndNormalize(embedding: number[]): number[] {
  const truncated = embedding.slice(0, EMBEDDING_DIMS);
  let norm = 0;
  for (const val of truncated) {
    norm += val * val;
  }
  norm = Math.sqrt(norm);

  const result = new Array<number>(EMBEDDING_DIMS);
  for (let i = 0; i < EMBEDDING_DIMS; i++) {
    result[i] = norm > 0 ? truncated[i] / norm : 0;
  }
  return result;
}

async function loadPipeline(): Promise<void> {
  const transformers = await import('@huggingface/transformers');

  send({ type: 'progress', status: 'downloading', progress: 0 });

  pipeline = await transformers.pipeline('feature-extraction', MODEL_ID, {
    dtype: 'q8' as const,
    cache_dir: cacheDir!,
    progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
      if (progress.status === 'progress') {
        send({ type: 'progress', status: 'downloading', progress: progress.progress, file: progress.file });
      }
    },
  });

  send({ type: 'progress', status: 'ready' });
}

function send(message: Record<string, unknown>): void {
  if (process.send) {
    process.send(message);
  }
}

async function handleMessage(message: {
  type: string;
  id?: string;
  cacheDir?: string;
  texts?: string[];
  query?: string;
}): Promise<void> {
  try {
    switch (message.type) {
      case 'init': {
        cacheDir = message.cacheDir!;
        await loadPipeline();
        send({ type: 'loaded' });
        break;
      }

      case 'embedDocuments': {
        const BATCH_SIZE = 4;
        const prefixedTexts = message.texts!.map((t: string) => `${DOCUMENT_PREFIX}${t}`);
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < prefixedTexts.length; i += BATCH_SIZE) {
          const batch = prefixedTexts.slice(i, i + BATCH_SIZE);
          const output = await pipeline(batch, { pooling: 'mean', normalize: true });
          const rawEmbeddings = output.tolist() as number[][];
          for (const emb of rawEmbeddings) {
            allEmbeddings.push(truncateAndNormalize(emb));
          }
        }

        send({ type: 'embeddings', id: message.id, embeddings: allEmbeddings });
        break;
      }

      case 'embedQuery': {
        const prefixedQuery = `${SEARCH_PREFIX}${message.query}`;
        const output = await pipeline([prefixedQuery], { pooling: 'mean', normalize: true });
        const rawEmbeddings = output.tolist() as number[][];
        const embedding = truncateAndNormalize(rawEmbeddings[0]);
        send({ type: 'embedding', id: message.id, embedding });
        break;
      }

      case 'shutdown': {
        process.exit(0);
        break;
      }

      default:
        send({ type: 'error', id: message.id, error: `Unknown message type: ${message.type}` });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    send({ type: 'error', id: message.id, error: errorMessage });
  }
}

process.on('message', (message: { type: string; id?: string; cacheDir?: string; texts?: string[]; query?: string }) => {
  handleMessage(message);
});
