import { app } from 'electron';

const MIN_INTERVAL_MS = 3000;
let lastCallTime = 0;

export async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastCallTime = Date.now();
  const version = app.getVersion();
  const userAgent = `PaperShelf/${version} (https://github.com/dakl/papershelf)`;
  return fetch(url, {
    ...init,
    headers: { ...init?.headers, 'User-Agent': userAgent },
  });
}
