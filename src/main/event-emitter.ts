import { EventEmitter } from 'events';

export enum DataChangeEvent {
  COLLECTIONS_CHANGED = 'collections:changed',
  TAGS_CHANGED = 'tags:changed',
  PAPERS_CHANGED = 'papers:changed',
  ANNOTATIONS_CHANGED = 'annotations:changed',
  IMPORT_PROGRESS = 'import:progress',
  METADATA_RESOLUTION_PROGRESS = 'metadata:resolution-progress',
  EMBEDDING_PROGRESS = 'embedding:progress',
  INDEXING_PROGRESS = 'indexing:progress',
}

class AppEventEmitter extends EventEmitter {}

export const eventEmitter = new AppEventEmitter();
