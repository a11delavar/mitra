import { EventEmitter } from 'node:events'

/**
 * Tracks active client connections per user to pace sync and background jobs.
 */
export class Presence {
	private readonly clients = new Map<string, number>()
	private readonly emitter = new EventEmitter()

	/** Register active connection and return disconnect cleanup function. */
	connect(userId: string) {
		const count = (this.clients.get(userId) ?? 0) + 1
		this.clients.set(userId, count)
		if (count === 1) {
			this.emitter.emit('online', userId)
		}
		let disconnected = false
		return () => {
			if (disconnected) {
				return
			}
			disconnected = true
			const remaining = (this.clients.get(userId) ?? 1) - 1
			if (remaining > 0) {
				this.clients.set(userId, remaining)
			} else {
				this.clients.delete(userId)
				this.emitter.emit('offline', userId)
			}
		}
	}

	isOnline(userId: string) {
		return this.clients.has(userId)
	}

	/** Listener fired when a user transitions from 0 to 1 active connections. */
	onOnline(listener: (userId: string) => void) {
		this.emitter.on('online', listener)
	}

	/** Listener fired when a user's active connection count drops to 0. */
	onOffline(listener: (userId: string) => void) {
		this.emitter.on('offline', listener)
	}
}

export const presence = new Presence()
