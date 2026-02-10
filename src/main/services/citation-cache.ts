import * as db from '../database';

export function isCitationCacheFresh(arxivId: string, ttlDays: number): boolean {
  const fetchedAt = db.getCitationFetchTime(arxivId);
  if (!fetchedAt) return false;
  const age = Date.now() - new Date(`${fetchedAt}Z`).getTime();
  return age < ttlDays * 24 * 60 * 60 * 1000;
}
