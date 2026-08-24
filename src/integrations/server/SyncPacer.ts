/** The pacing-relevant shape of an integration — structural on purpose, so the pacer (and its
 * tests) stay free of the ORM-decorated domain classes. */
export interface Paceable {
	id: string
	userId: string
	/** See Integration.syncInterval: 0 = no per-provider floor, Infinity = local-only, never polled. */
	syncInterval: number
}

/**
 * When each integration may sync next — the Synchronizer's decision core, kept free of ORM,
 * network, and timers so it is unit-testable on its own.
 *
 * Three floors stack per integration; the largest wins:
 *
 * - the scheduler cadence — {@link activeInterval} while the owner has a connected client (a
 *   watched calendar polls fast so remote edits feel live), {@link idleInterval} otherwise (an
 *   unwatched one mustn't flood a self-hosted home server all night; a client connecting triggers
 *   an immediate cycle, so nobody ever sits out the idle pace in front of a stale screen);
 * - the integration's own `syncInterval` — the provider's quota floor (Google, Notion);
 * - the failure rest — a flat {@link retryInterval}, not an exponential ladder: the per-provider
 *   `syncInterval` is what keeps mitra inside provider quotas, and at these volumes a once-a-minute
 *   retry is already far below any limit — exponential backoff bought complexity, not protection.
 *   Flat also keeps recovery snappy: a server that comes back is picked up within a minute.
 *
 * All state is in-memory on purpose — a restart simply retries everything, which is the right recovery.
 */
export class SyncPacer {
	/** Poll pace while the owner is watching — what makes remote edits feel live. */
	static readonly activeInterval = 10_000
	/** Poll pace while no client of the owner is connected. Freshness only matters to reminders
	 * then (push fires from the local rows, so a remotely-authored reminder can arrive up to this
	 * much later) — worth the 30× quieter idle traffic. */
	static readonly idleInterval = 5 * 60_000
	/** How long a FAILED integration rests before its next attempt (a healthy one follows the
	 * cadence and its own `syncInterval`). */
	static readonly retryInterval = 60_000

	/** When each integration last attempted a sync, and how that went. */
	private readonly attempts = new Map<string, { at: number, failed: boolean }>()

	constructor(private readonly clients: { isOnline(userId: string): boolean }) { }

	/**
	 * Whether the integration may sync now. A local-only integration never does: with no remote,
	 * there is nothing to fetch. Everything else waits out its rest — including the cycle a
	 * connecting client triggers, so reload-spamming can never hammer a provider.
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

	/** Records the failure and returns how long the integration now rests, for the caller's log line. */
	recordFailure(integration: Paceable, now = Date.now()) {
		this.attempts.set(integration.id, { at: now, failed: true })
		return this.restFor(integration, true)
	}

	/** Deleted integrations leave the pacing state with them. Call with the FULL live id set only —
	 * pruning against a user-scoped subset would wipe everyone else's pacing. */
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
