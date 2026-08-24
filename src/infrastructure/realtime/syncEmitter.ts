import { EventEmitter } from 'node:events'

/**
 * Emits `'updated'` whenever data changes (a write endpoint or the background sync), carrying the id
 * of the user whose data changed. The `/api/events` SSE feed forwards it to that user's connected
 * clients so they refetch — the tick itself is content-free, but even a content-free "something of
 * yours changed" belongs only to its owner.
 */
export const syncEmitter = new EventEmitter()
