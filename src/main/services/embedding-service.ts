import type { ChildProcess } from 'child_process';
import { execSync, fork } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { DataChangeEvent, eventEmitter } from '../event-emitter';
import { getDataDir } from '../paths';

let child: ChildProcess | null = null;
let modelLoaded = false;
let loadingPromise: Promise<void> | null = null;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

const pendingRequests = new Map<string, PendingRequest>();

// Serial queue: ensures only one embedding request is in-flight at a time
let queueTail: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queueTail.then(fn, fn);
  queueTail = result.then(
    () => {},
    () => {},
  );
  return result;
}

function getModelCacheDir(): string {
  return path.join(getDataDir(), 'models');
}

function getNodeBinaryPath(): string {
  const candidates = ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node'];

  try {
    const nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
    if (nodePath) return nodePath;
  } catch {
    // which failed, try known paths
  }

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { encoding: 'utf-8' });
      return candidate;
    } catch {
      // not found, try next
    }
  }

  throw new Error('Could not find system Node.js binary. Install Node.js to enable semantic search.');
}

function getWorkerScriptPath(): string {
  const scriptPath = path.join(__dirname, 'embedding-worker.js');
  // In packaged app, the worker must be outside .asar
  return scriptPath.replace('.asar', '.asar.unpacked');
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

function rejectAllPending(error: Error): void {
  for (const [id, request] of pendingRequests) {
    request.reject(error);
    pendingRequests.delete(id);
  }
}

function spawnChild(): ChildProcess {
  const nodeBinary = getNodeBinaryPath();
  const workerScript = getWorkerScriptPath();

  console.log(`[embedding-service] Spawning worker: ${nodeBinary} ${workerScript}`);

  const childProcess = fork(workerScript, [], {
    execPath: nodeBinary,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  childProcess.on('message', (message: { type: string; id?: string; [key: string]: unknown }) => {
    switch (message.type) {
      case 'progress': {
        eventEmitter.emit(DataChangeEvent.EMBEDDING_PROGRESS, {
          status: message.status,
          progress: message.progress,
          file: message.file,
          error: message.error,
        });
        break;
      }

      case 'loaded': {
        modelLoaded = true;
        break;
      }

      case 'embeddings': {
        const request = pendingRequests.get(message.id!);
        if (request) {
          pendingRequests.delete(message.id!);
          const rawEmbeddings = message.embeddings as number[][];
          const result = rawEmbeddings.map((emb) => Float32Array.from(emb));
          request.resolve(result);
        }
        break;
      }

      case 'embedding': {
        const request = pendingRequests.get(message.id!);
        if (request) {
          pendingRequests.delete(message.id!);
          request.resolve(Float32Array.from(message.embedding as number[]));
        }
        break;
      }

      case 'error': {
        if (message.id) {
          const request = pendingRequests.get(message.id);
          if (request) {
            pendingRequests.delete(message.id);
            request.reject(new Error(message.error as string));
          }
        }
        break;
      }
    }
  });

  childProcess.on('error', (err) => {
    console.error('Embedding worker process error:', err.message);
    rejectAllPending(err);
    resetState();
  });

  childProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.warn(`Embedding worker exited with code ${code}, signal ${signal}`);
      rejectAllPending(new Error(`Embedding worker crashed (code ${code})`));
    }
    resetState();
  });

  childProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[embedding-worker stdout]', data.toString().trimEnd());
  });

  childProcess.stderr?.on('data', (data: Buffer) => {
    console.warn('[embedding-worker stderr]', data.toString().trimEnd());
  });

  return childProcess;
}

function resetState(): void {
  child = null;
  modelLoaded = false;
  loadingPromise = null;
}

function ensureChild(): ChildProcess {
  if (!child || !child.connected) {
    child = spawnChild();
  }
  return child;
}

export async function ensureModelLoaded(): Promise<void> {
  if (modelLoaded && child?.connected) return;

  if (loadingPromise) {
    console.log('[embedding-service] Waiting on existing loadingPromise');
    await loadingPromise;
    return;
  }

  console.log('[embedding-service] Starting model load via child process');

  loadingPromise = new Promise<void>((resolve, reject) => {
    try {
      const childProcess = ensureChild();

      const onLoaded = (message: { type: string }) => {
        if (message.type === 'loaded') {
          childProcess.removeListener('message', onLoaded);
          resolve();
        } else if (message.type === 'error' && !modelLoaded) {
          childProcess.removeListener('message', onLoaded);
          const errorMessage = (message as { error?: string }).error || 'Failed to load model';
          reject(new Error(errorMessage));
        }
      };

      childProcess.on('message', onLoaded);
      childProcess.send({ type: 'init', cacheDir: getModelCacheDir() });
    } catch (err) {
      resetState();
      reject(err);
    }
  }).catch((err) => {
    resetState();
    eventEmitter.emit(DataChangeEvent.EMBEDDING_PROGRESS, {
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to load model',
    });
    throw err;
  });

  await loadingPromise;
}

export function isModelLoaded(): boolean {
  return modelLoaded;
}

function sendEmbedDocuments(texts: string[]): Promise<Float32Array[]> {
  const id = generateRequestId();
  const childProcess = ensureChild();
  console.log(`[embedding-service] embedDocumentTexts: ${texts.length} texts, request ${id}`);

  return new Promise<Float32Array[]>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    childProcess.send({ type: 'embedDocuments', id, texts });
  });
}

function sendEmbedQuery(query: string): Promise<Float32Array> {
  const id = generateRequestId();
  const childProcess = ensureChild();

  return new Promise<Float32Array>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    childProcess.send({ type: 'embedQuery', id, query });
  });
}

export async function embedDocumentTexts(texts: string[]): Promise<Float32Array[]> {
  await ensureModelLoaded();
  return enqueue(() => sendEmbedDocuments(texts));
}

export async function embedQuery(query: string): Promise<Float32Array> {
  await ensureModelLoaded();
  return enqueue(() => sendEmbedQuery(query));
}

export function shutdownEmbeddingService(): void {
  if (child?.connected) {
    child.send({ type: 'shutdown' });
    setTimeout(() => {
      if (child && !child.killed) {
        child.kill();
      }
      resetState();
    }, 2000);
  } else {
    resetState();
  }
}
