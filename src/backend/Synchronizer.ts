import { type MikroORM } from '@mikro-orm/sqlite'
import { syncEmitter } from './syncEmitter.js'
import { Integration, createLogger } from '../shared/index.js'

export class Synchronizer {
	private readonly logger = createLogger('Synchronizer')

	private static readonly interval = 10_000

	/**
	 * How long a FAILED integration rests before its next attempt (a healthy one follows its own
	 * `syncInterval`). A flat floor, not an exponential ladder: the per-provider `syncInterval` is
	 * what keeps mitra inside provider quotas (Google's CalDAV shares the Calendar API limits —
	 * 600 requests/min/user, 1M/day/project; an idle sync is ~9 requests, so 60s pacing spends
	 * ~13k/day per account), and at those volumes a once-a-minute retry is already far below any
	 * limit — exponential backoff bought complexity, not protection. Flat also keeps recovery
	 * snappy: a server that comes back is picked up within a minute, not after a grown backoff.
	 */
	private static readonly retryInterval = 60_000

	private syncing = false

	/** When each integration may sync next. In-memory on purpose — a restart simply retries
	 * everything, which is the right recovery. */
	private readonly nextSyncAt = new Map<string, number>()

	constructor(private readonly orm: MikroORM) { }

	async start() {
		this.logger.info(`Started synchronizer. Will synchronize every ${Synchronizer.interval / 1000}s.`)
		await this.syncAll()
		setInterval(() => this.syncAll(), Synchronizer.interval)
	}

	private async syncAll() {
		// Skip this tick if the previous run is still going — a slow sync (e.g. the initial full
		// fetch) would otherwise overlap with the next and race to insert the same rows.
		if (this.syncing) {
			return
		}
		this.syncing = true
		try {
			const em = this.orm.em.fork()
			const integrations = await em.find(Integration, {})

			// The daemon syncs EVERY user's integrations; ticks go out per affected owner.
			const changedUsers = new Set<string>()
			let changedIntegrations = 0
			for (const integration of integrations) {
				if (Date.now() < (this.nextSyncAt.get(integration.id) ?? 0)) {
					continue
				}
				try {
					this.logger.debug(`Syncing ${integration.toString()}`)
					if (await integration.sync(em)) {
						changedUsers.add(integration.userId)
						changedIntegrations++
					}
					this.nextSyncAt.set(integration.id, Date.now() + integration.syncInterval)
				} catch (error) {
					// One failing integration (server down, revoked grant, provider rate limit) must
					// neither block the other integrations in this cycle nor be hammered every tick.
					const retryIn = Math.max(integration.syncInterval, Synchronizer.retryInterval)
					this.nextSyncAt.set(integration.id, Date.now() + retryIn)
					this.logger.warn(`Sync of ${integration.toString()} failed (retrying in ${retryIn / 1000}s):`, error)
				}
			}
			// Deleted integrations leave the pacing map with them.
			const ids = new Set(integrations.map(integration => integration.id))
			for (const id of this.nextSyncAt.keys()) {
				if (!ids.has(id)) {
					this.nextSyncAt.delete(id)
				}
			}

			await em.flush()
			// Only a cycle that actually pulled remote changes is worth info — that's an infrequent, real
			// event (someone edited a calendar elsewhere). Idle cycles (every 10s) stay at trace so a healthy
			// server's info log doesn't scroll with heartbeats.
			if (changedIntegrations) {
				this.logger.info(`Synced remote changes from ${changedIntegrations} integration(s); notifying ${changedUsers.size} user(s)`)
			} else {
				this.logger.verbose(`Sync cycle complete: ${integrations.length} integration(s), no changes`)
			}
			for (const userId of changedUsers) {
				syncEmitter.emit('updated', userId)
			}
		} catch (error) {
			this.logger.error('Sync failed:', error)
		} finally {
			this.syncing = false
		}
	}
}
