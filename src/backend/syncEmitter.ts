import { EventEmitter } from 'node:events'

/**
 * Emits `'updated'` whenever data changes (a write endpoint or the background sync). The
 * `/api/events` SSE feed forwards it to connected clients so they refetch.
 */
export const syncEmitter = new EventEmitter()
