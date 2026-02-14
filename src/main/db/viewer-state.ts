import type { ViewerState } from '../../shared/types';
import { getDb } from './connection';

interface ViewerStateRow {
  paper_id: string;
  scale: number;
  scroll_top: number;
  scroll_left: number;
}

export function getViewerState(paperId: string): ViewerState | null {
  const db = getDb();
  const row = db
    .prepare('SELECT paper_id, scale, scroll_top, scroll_left FROM paper_viewer_state WHERE paper_id = ?')
    .get(paperId) as ViewerStateRow | undefined;

  if (!row) return null;

  return {
    paperId: row.paper_id,
    scale: row.scale,
    scrollTop: row.scroll_top,
    scrollLeft: row.scroll_left,
  };
}

export function saveViewerState(paperId: string, scale: number, scrollTop: number, scrollLeft: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO paper_viewer_state (paper_id, scale, scroll_top, scroll_left, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(paper_id) DO UPDATE SET
       scale = excluded.scale,
       scroll_top = excluded.scroll_top,
       scroll_left = excluded.scroll_left,
       updated_at = excluded.updated_at`,
  ).run(paperId, scale, scrollTop, scrollLeft);
}
