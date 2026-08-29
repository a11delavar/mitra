export interface Paceable {
	id: string
	userId: string
	syncInterval: number
}

/**
 * Calculates sync eligibility based on client presence, provider quotas, and failure backoffs.
 */
export class SyncPacer {
	static readonly activeInterval = 10_000
	static readonly idleInterval = 5 * 60_000
	static readonly retryInterval = 60_000

	private readonly attempts = new Map<string, { at: number, failed: boolean }>()

	constructor(private readonly clients: { isOnline(userId: string): boolean }) { }

	/**
	 * Returns whether the integration is eligible to sync given its last attempt and presence state.
	 */
	shouldSync(integration: Paceable, options?: { now?: number }) {
		if (!Number.isFinite(integration.syncInterval)) {
			return false
		}
		const attempt = this.attempts.get(integration.id)
		return !attempt || (options?.now ?? Date.now()) - attempt.at >= this.restFor(integration, attempt.failed)
	}

	recordSuccess(integration: Paceable, now = Date.now()) {
		this.attempts.set(integration.id, { at: now, failed: false })
	}

	recordFailure(integration: Paceable, now = Date.now()) {
		this.attempts.set(integration.id, { at: now, failed: true })
		return this.restFor(integration, true)
	}

	prune(liveIds: ReadonlySet<string>) {
		for (const id of this.attempts.keys()) {
			if (!liveIds.has(id)) {
				this.attempts.delete(id)
			}
		}
	}

	private restFor(integration: Paceable, failed: boolean) {
		const cadence = this.clients.isOnline(integration.userId) ? SyncPacer.activeInterval : SyncPacer.idleInterval
		return Math.max(cadence, integration.syncInterval, failed ? SyncPacer.retryInterval : 0)
	}
}
