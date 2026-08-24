import { type MikroORM } from '@mikro-orm/sqlite'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { presence } from '../../infrastructure/realtime/presence.js'
import { SyncPacer } from './SyncPacer.js'
import { orm } from '../../infrastructure/database/orm.js'
import { createLogger } from '../../infrastructure/logging/Logger.js'
import { Integration } from '../Integration.js'

/**
 * The background sync daemon: polls every user's integrations for remote changes, at a pace the
 * {@link SyncPacer} decides per integration — fast while the owner has a client connected, slow
 * while nobody is looking, floored by the provider's own `syncInterval`. Local writes never wait
 * for it (the write endpoints push to the provider directly); it exists purely to PULL changes
 * made elsewhere.
 *
 * Two things start a cycle, both funnelled through one queue so runs never overlap (overlapping
 * cycles would race to insert the same rows):
 * - the heartbeat, every {@link resolution} — a cheap due-ness re-evaluation, not a poll rate;
 * - a user coming online (page load/reload, laptop waking) — they expect to see what changed
 *   while they were away, so their integrations sync right then.
 *
 * There is deliberately no manual "sync now": syncing is this daemon's business, and a refresh
 * button in the UI would suggest the calendar on screen might be stale. Reloading the page is the
 * one gesture users already reach for, and presence turns it into a sync for free. A re-import
 * (`Integration.reimportSource`) is a different operation entirely — it throws the local cache
 * away and rebuilds it — and keeps its own explicit, user-invoked route.
 */
export class Synchronizer {
	private readonly logger = createLogger('Synchronizer')

	/** How often due-ness is re-evaluated. Each tick only asks the pacer which integrations are
	 * due (no I/O happens for the resting ones), so this is the scheduler's RESOLUTION — the
	 * actual per-integration pace is the pacer's floors. */
	private static readonly resolution = 10_000

	private readonly pacer = new SyncPacer(presence)

	/** The cycle queue: pending counts queued + running cycles, and the chain runs them strictly
	 * one after another (kept alive past failures). */
	private chain = Promise.resolve()
	private pending = 0

	constructor(private readonly orm: MikroORM) { }

	start() {
		this.logger.info(`Started synchronizer. Will poll watched integrations every ${SyncPacer.activeInterval / 1000}s, unwatched ones every ${SyncPacer.idleInterval / 60_000}min.`)
		// The pace transitions, told as they happen — so a debug log answers "why did/didn't it poll
		// just now" without the reader reconstructing presence from request lines.
		presence.onOnline(userId => {
			this.logger.debug(`User ${userId} came online — syncing now, then polling every ${SyncPacer.activeInterval / 1000}s while connected`)
			this.syncSafely({ userId })
		})
		presence.onOffline(userId =>
			this.logger.debug(`User ${userId} went offline — polling relaxes to every ${SyncPacer.idleInterval / 60_000}min`))
		this.syncSafely()
		setInterval(() => {
			// Skip the heartbeat while a cycle is queued or running — due-ness is re-evaluated per
			// cycle anyway, so stacking ticks behind a slow sync (e.g. an initial full fetch) buys nothing.
			if (!this.pending) {
				this.syncSafely()
			}
		}, Synchronizer.resolution)
	}

	/** Queues a cycle. Never rejects — an unhandled rejection would take the process down — and
	 * never overlaps another: cycles run strictly one after another. */
	private syncSafely(options?: { userId?: string }) {
		this.pending++
		const run = this.chain.then(() => this.cycle(options)).finally(() => this.pending--)
		this.chain = run.catch(error => this.logger.error('Sync failed:', error))
	}

	private async cycle({ userId }: { userId?: string } = {}) {
		const em = this.orm.em.fork()
		const integrations = await em.find(Integration, userId ? { userId } : {})

		// The daemon syncs EVERY user's integrations; ticks go out per affected owner.
		const changedUsers = new Set<string>()
		let changedIntegrations = 0
		for (const integration of integrations) {
			if (!this.pacer.shouldSync(integration)) {
				continue
			}
			try {
				this.logger.debug(`Syncing ${integration.toString()}`)
				if (await integration.sync(em)) {
					changedUsers.add(integration.userId)
					changedIntegrations++
				}
				this.pacer.recordSuccess(integration)
			} catch (error) {
				// One failing integration (server down, revoked grant, provider rate limit) must
				// neither block the other integrations in this cycle nor be hammered every tick.
				const retryIn = this.pacer.recordFailure(integration)
				this.logger.warn(`Sync of ${integration.toString()} failed (retrying in ${retryIn / 1000}s):`, error)
			}
		}
		// Deleted integrations leave the pacing state with them — judged on FULL cycles only,
		// which are the only ones that see every live id.
		if (!userId) {
			this.pacer.prune(new Set(integrations.map(integration => integration.id)))
		}

		await em.flush()
		// Only a cycle that actually pulled remote changes is worth info — that's an infrequent, real
		// event (someone edited a calendar elsewhere). Idle cycles stay at trace so a healthy server's
		// info log doesn't scroll with heartbeats.
		if (changedIntegrations) {
			this.logger.info(`Synced remote changes from ${changedIntegrations} integration(s); notifying ${changedUsers.size} user(s)`)
		} else {
			this.logger.verbose(`Sync cycle complete: ${integrations.length} integration(s), no changes`)
		}
		for (const changedUserId of changedUsers) {
			syncEmitter.emit('updated', changedUserId)
		}
	}
}

/** The one instance: server.ts starts it, the refresh endpoint (integrations.ts) triggers it. */
export const synchronizer = new Synchronizer(orm)
