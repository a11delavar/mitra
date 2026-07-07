import { type MikroORM } from '@mikro-orm/sqlite'
import { syncEmitter } from './syncEmitter.js'
import { Integration, createLogger } from '../shared/index.js'

export class Synchronizer {
	private readonly logger = createLogger('Synchronizer')

	private static readonly interval = 10_000

	private syncing = false

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
				this.logger.debug(`Syncing ${integration.toString()}`)
				if (await integration.sync(em)) {
					changedUsers.add(integration.userId)
					changedIntegrations++
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
