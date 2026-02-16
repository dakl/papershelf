import type { Tag } from '../../shared/types';
import { generateId, getDb, rowToTag, type TagRow } from './connection';
import { eventEmitter, DataChangeEvent } from '../event-emitter';

export function getTagByName(name: string): Tag | null {
  const db = getDb();
  const row = db
    .prepare(`
    SELECT t.*, COUNT(pt.paper_id) as paper_count
    FROM tags t
    LEFT JOIN paper_tags pt ON t.id = pt.tag_id
    WHERE t.name = ?
    GROUP BY t.id
  `)
    .get(name) as TagRow | undefined;
  return row ? rowToTag(row) : null;
}

export function getTags(): Tag[] {
  const db = getDb();
  const rows = db
    .prepare(`
    SELECT t.*, COUNT(pt.paper_id) as paper_count
    FROM tags t
    LEFT JOIN paper_tags pt ON t.id = pt.tag_id
    GROUP BY t.id
    ORDER BY t.name
  `)
    .all() as TagRow[];
  return rows.map(rowToTag);
}

export function createTag(name: string, color: string): Tag {
  const db = getDb();
  const id = generateId();
  db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name, color);
  const tag = { id, name, color, paperCount: 0, createdAt: new Date().toISOString() };
  
  // Emit event when tag is created
  eventEmitter.emit(DataChangeEvent.TAGS_CHANGED);
  
  return tag;
}

export function updateTag(id: string, name: string, color: string): Tag {
  const db = getDb();
  db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, id);
  const row = db
    .prepare(`
    SELECT t.*, COUNT(pt.paper_id) as paper_count
    FROM tags t
    LEFT JOIN paper_tags pt ON t.id = pt.tag_id
    WHERE t.id = ?
    GROUP BY t.id
  `)
    .get(id) as TagRow;
  
  // Emit event when tag is updated
  eventEmitter.emit(DataChangeEvent.TAGS_CHANGED);
  
  return rowToTag(row);
}

export function deleteTag(id: string): void {
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(id);
  
  // Emit event when tag is deleted
  eventEmitter.emit(DataChangeEvent.TAGS_CHANGED);
}

export function addTagToPaper(paperId: string, tagId: string): void {
  getDb().prepare('INSERT OR IGNORE INTO paper_tags (paper_id, tag_id) VALUES (?, ?)').run(paperId, tagId);
  
  // Emit event when tag is added to paper
  eventEmitter.emit(DataChangeEvent.TAGS_CHANGED);
}

export function removeTagFromPaper(paperId: string, tagId: string): void {
  getDb().prepare('DELETE FROM paper_tags WHERE paper_id = ? AND tag_id = ?').run(paperId, tagId);
  
  // Emit event when tag is removed from paper
  eventEmitter.emit(DataChangeEvent.TAGS_CHANGED);
}

export function getTagsForPaper(paperId: string): Tag[] {
  const db = getDb();
  const rows = db
    .prepare(`
    SELECT t.*, COUNT(pt2.paper_id) as paper_count
    FROM tags t
    JOIN paper_tags pt ON t.id = pt.tag_id
    LEFT JOIN paper_tags pt2 ON t.id = pt2.tag_id
    WHERE pt.paper_id = ?
    GROUP BY t.id
  `)
    .all(paperId) as TagRow[];
  return rows.map(rowToTag);
}

export function getTagsForPapers(paperIds: string[]): Map<string, Tag[]> {
  const result = new Map<string, Tag[]>();
  if (paperIds.length === 0) return result;

  const db = getDb();
  const placeholders = paperIds.map(() => '?').join(',');

  const rows = db
    .prepare(
      `
    SELECT pt.paper_id, t.*, COUNT(pt2.paper_id) as paper_count
    FROM tags t
    JOIN paper_tags pt ON t.id = pt.tag_id
    LEFT JOIN paper_tags pt2 ON t.id = pt2.tag_id
    WHERE pt.paper_id IN (${placeholders})
    GROUP BY pt.paper_id, t.id
  `,
    )
    .all(...paperIds) as (TagRow & { paper_id: string })[];

  for (const paperId of paperIds) {
    result.set(paperId, []);
  }

  for (const row of rows) {
    result.get(row.paper_id)!.push(rowToTag(row));
  }

  return result;
}
