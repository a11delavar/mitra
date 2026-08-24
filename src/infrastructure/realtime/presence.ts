import { EventEmitter } from 'node:events'

/**
 * Which users currently have a connected client — one open `/api/events` stream counts as one
 * client, so "online" means a browser tab (or installed app window) is showing the calendar right
 * now. The Synchronizer paces remote polling off this: a watched calendar deserves live updates,
 * an unwatched one shouldn't flood a self-hosted home server all night.
 *
 * Purely in-memory: a restart drops to "everyone offline" until the streams reconnect — which they
 * do within seconds (EventSource retries on its own), each reconnect announcing itself below.
 */
export class Presence {
	/** Connected-client count per user id. */
	private readonly clients = new Map<string, number>()
	private readonly emitter = new EventEmitter()

	/** Registers a connected client and returns the matching disconnect — idempotent, so a
	 * double-fired teardown can never corrupt a newer connection's count. */
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

	/** Fires when a user goes from zero connected clients to one — a page load, a reload, a laptop
	 * waking up (its dropped stream reconnects). Exactly the moments a user expects fresh data. */
	onOnline(listener: (userId: string) => void) {
		this.emitter.on('online', listener)
	}

	/** The mirror transition: the user's last client disconnected. */
	onOffline(listener: (userId: string) => void) {
		this.emitter.on('offline', listener)
	}
}

export const presence = new Presence()
