import { EventEmitter } from 'events';

export enum DataChangeEvent {
  COLLECTIONS_CHANGED = 'collections:changed',
  TAGS_CHANGED = 'tags:changed',
  PAPERS_CHANGED = 'papers:changed',
  ANNOTATIONS_CHANGED = 'annotations:changed',
}

class AppEventEmitter extends EventEmitter {}

export const eventEmitter = new AppEventEmitter();
