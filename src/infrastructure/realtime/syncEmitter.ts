import { EventEmitter } from 'node:events'

/** Change scope: 'entries' for event/task changes, or 'sources' for calendar list and metadata changes. */
export type SyncScope = 'entries' | 'sources'

/** Emits user-scoped `'updated'` events to notify SSE clients of data changes. */
export const syncEmitter = new EventEmitter()
