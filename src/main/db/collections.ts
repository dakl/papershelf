import type { Collection } from '../../shared/types';
import { DataChangeEvent, eventEmitter } from '../event-emitter';
import { type CollectionRow, generateId, getDb, rowToCollection } from './connection';

export function getCollectionByName(name: string): Collection | null {
  const db = getDb();
  const row = db
    .prepare(`
    SELECT c.*, COUNT(pc.paper_id) as paper_count
    FROM collections c
    LEFT JOIN paper_collections pc ON c.id = pc.collection_id
    WHERE c.name = ?
    GROUP BY c.id
  `)
    .get(name) as CollectionRow | undefined;
  return row ? rowToCollection(row) : null;
}

export function getCollections(): Collection[] {
  const db = getDb();
  const rows = db
    .prepare(`
    SELECT c.*, COUNT(pc.paper_id) as paper_count
    FROM collections c
    LEFT JOIN paper_collections pc ON c.id = pc.collection_id
    GROUP BY c.id
    ORDER BY c.name
  `)
    .all() as CollectionRow[];
  return rows.map(rowToCollection);
}

export function createCollection(name: string, color: string): Collection {
  const db = getDb();
  const id = generateId();
  db.prepare('INSERT INTO collections (id, name, color) VALUES (?, ?, ?)').run(id, name, color);
  const collection = { id, name, color, paperCount: 0, createdAt: new Date().toISOString() };

  // Emit event when collection is created
  eventEmitter.emit(DataChangeEvent.COLLECTIONS_CHANGED);

  return collection;
}

export function updateCollection(id: string, name: string, color: string): Collection {
  const db = getDb();
  db.prepare('UPDATE collections SET name = ?, color = ? WHERE id = ?').run(name, color, id);
  const row = db
    .prepare(`
    SELECT c.*, COUNT(pc.paper_id) as paper_count
    FROM collections c
    LEFT JOIN paper_collections pc ON c.id = pc.collection_id
    WHERE c.id = ?
    GROUP BY c.id
  `)
    .get(id) as CollectionRow;

  // Emit event when collection is updated
  eventEmitter.emit(DataChangeEvent.COLLECTIONS_CHANGED);

  return rowToCollection(row);
}

export function deleteCollection(id: string): void {
  getDb().prepare('DELETE FROM collections WHERE id = ?').run(id);

  // Emit event when collection is deleted
  eventEmitter.emit(DataChangeEvent.COLLECTIONS_CHANGED);
}

export function addPaperToCollection(paperId: string, collectionId: string): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO paper_collections (paper_id, collection_id) VALUES (?, ?)')
    .run(paperId, collectionId);

  // Emit event when paper is added to collection
  eventEmitter.emit(DataChangeEvent.COLLECTIONS_CHANGED);
}

export function removePaperFromCollection(paperId: string, collectionId: string): void {
  getDb().prepare('DELETE FROM paper_collections WHERE paper_id = ? AND collection_id = ?').run(paperId, collectionId);

  // Emit event when paper is removed from collection
  eventEmitter.emit(DataChangeEvent.COLLECTIONS_CHANGED);
}

export function getCollectionsForPaper(paperId: string): Collection[] {
  const db = getDb();
  const rows = db
    .prepare(`
    SELECT c.*, COUNT(pc2.paper_id) as paper_count
    FROM collections c
    JOIN paper_collections pc ON c.id = pc.collection_id
    LEFT JOIN paper_collections pc2 ON c.id = pc2.collection_id
    WHERE pc.paper_id = ?
    GROUP BY c.id
  `)
    .all(paperId) as CollectionRow[];
  return rows.map(rowToCollection);
}

export function getCollectionsForPapers(paperIds: string[]): Map<string, Collection[]> {
  const result = new Map<string, Collection[]>();
  if (paperIds.length === 0) return result;

  const db = getDb();
  const placeholders = paperIds.map(() => '?').join(',');

  const rows = db
    .prepare(
      `
    SELECT pc.paper_id, c.*, COUNT(pc2.paper_id) as paper_count
    FROM collections c
    JOIN paper_collections pc ON c.id = pc.collection_id
    LEFT JOIN paper_collections pc2 ON c.id = pc2.collection_id
    WHERE pc.paper_id IN (${placeholders})
    GROUP BY pc.paper_id, c.id
  `,
    )
    .all(...paperIds) as (CollectionRow & { paper_id: string })[];

  for (const paperId of paperIds) {
    result.set(paperId, []);
  }

  for (const row of rows) {
    result.get(row.paper_id)!.push(rowToCollection(row));
  }

  return result;
}
