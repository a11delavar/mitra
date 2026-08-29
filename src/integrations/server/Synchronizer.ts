import { type MikroORM } from '@mikro-orm/sqlite'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { presence } from '../../infrastructure/realtime/presence.js'
import { SyncPacer } from './SyncPacer.js'
import { orm } from '../../infrastructure/database/orm.js'
import { createLogger } from '../../infrastructure/logging/Logger.js'
import { Integration } from '../Integration.js'

/**
 * Background sync daemon polling integrations for remote changes.
 */
export class Synchronizer {
	private readonly logger = createLogger('Synchronizer')

	private static readonly resolution = 10_000

	private readonly pacer = new SyncPacer(presence)

	private chain = Promise.resolve()
	private pending = 0

	constructor(private readonly orm: MikroORM) { }

	start() {
		this.logger.info(`Started synchronizer. Will poll watched integrations every ${SyncPacer.activeInterval / 1000}s, unwatched ones every ${SyncPacer.idleInterval / 60_000}min.`)
		presence.onOnline(userId => {
			this.logger.debug(`User ${userId} came online — syncing now, then polling every ${SyncPacer.activeInterval / 1000}s while connected`)
			this.syncSafely({ userId })
		})
		presence.onOffline(userId =>
			this.logger.debug(`User ${userId} went offline — polling relaxes to every ${SyncPacer.idleInterval / 60_000}min`))
		this.syncSafely()
		setInterval(() => {
			if (!this.pending) {
				this.syncSafely()
			}
		}, Synchronizer.resolution)
	}

	private syncSafely(options?: { userId?: string }) {
		this.pending++
		const run = this.chain.then(() => this.cycle(options)).finally(() => this.pending--)
		this.chain = run.catch(error => this.logger.error('Sync failed:', error))
	}

	private async cycle({ userId }: { userId?: string } = {}) {
		const em = this.orm.em.fork()
		const integrations = await em.find(Integration, userId ? { userId } : {})

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
				const retryIn = this.pacer.recordFailure(integration)
				this.logger.warn(`Sync of ${integration.toString()} failed (retrying in ${retryIn / 1000}s):`, error)
			}
		}
		if (!userId) {
			this.pacer.prune(new Set(integrations.map(integration => integration.id)))
		}

		await em.flush()
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

export const synchronizer = new Synchronizer(orm)
