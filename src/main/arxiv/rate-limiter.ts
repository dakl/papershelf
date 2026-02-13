const MIN_INTERVAL_MS = 3000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
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
