import { fork } from 'child_process';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const WORKER_SCRIPT = path.join(__dirname, '../../..', 'dist/main/main/services/embedding-worker.js');

describe('embedding-worker child process', () => {
  const children: ReturnType<typeof fork>[] = [];

  afterEach(() => {
    for (const child of children) {
      if (child.connected) {
        child.kill();
      }
    }
    children.length = 0;
  });

  it('starts without crashing (sharp stub works)', async () => {
    const child = fork(WORKER_SCRIPT, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);

    const result = await new Promise<{ started: boolean; error?: string }>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ started: true });
      }, 3000);

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ started: false, error: err.message });
      });

      child.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && code !== null) {
          resolve({ started: false, error: `Worker exited with code ${code}` });
        }
      });
    });

    expect(result.started).toBe(true);

    child.send({ type: 'shutdown' });
  });

  it('responds to shutdown message', async () => {
    const child = fork(WORKER_SCRIPT, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);

    // Wait for process to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('exit', (code) => resolve(code));
      child.send({ type: 'shutdown' });
    });

    expect(exitCode).toBe(0);
  });

  it('sends error for unknown message types', async () => {
    const child = fork(WORKER_SCRIPT, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);

    // Wait for process to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    const response = await new Promise<{ type: string; error?: string }>((resolve) => {
      child.on('message', (msg) => resolve(msg as { type: string; error?: string }));
      child.send({ type: 'invalid-type', id: 'test-1' });
    });

    expect(response.type).toBe('error');
    expect(response.error).toContain('Unknown message type');

    child.send({ type: 'shutdown' });
  });

  it('collects stderr without sharp import errors', async () => {
    const child = fork(WORKER_SCRIPT, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);

    const stderrChunks: string[] = [];
    child.stderr?.on('data', (data: Buffer) => {
      stderrChunks.push(data.toString());
    });

    // Wait for process to start and any immediate errors
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const stderr = stderrChunks.join('');
    expect(stderr).not.toContain('Cannot find package');
    expect(stderr).not.toContain('sharp');

    child.send({ type: 'shutdown' });
  });
});
