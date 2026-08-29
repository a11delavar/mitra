import { EventEmitter } from 'node:events'

/** Emits user-scoped `'updated'` events to notify SSE clients of data changes. */
export const syncEmitter = new EventEmitter()
