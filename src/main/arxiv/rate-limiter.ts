import pkg from '../../../package.json';

const MIN_INTERVAL_MS = 3000;
const USER_AGENT = `PaperShelf/${pkg.version} (https://github.com/dakl/papershelf)`;
let lastCallTime = 0;

export async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastCallTime = Date.now();
  return fetch(url, {
    ...init,
    headers: { ...init?.headers, 'User-Agent': USER_AGENT },
  });
}
