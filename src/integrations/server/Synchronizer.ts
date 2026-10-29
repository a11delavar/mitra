import { type MikroORM } from '@mikro-orm/sqlite'
import { Integration } from '#integrations'
import { updates } from '#infrastructure/realtime/Updates.js'
import { presence } from '#infrastructure/realtime/presence.js'
import { orm } from '#infrastructure/database/orm.js'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { BackgroundJob } from '#infrastructure/server/BackgroundJob.js'
import { SyncPacer } from './SyncPacer.js'

/**
 * Background sync daemon polling integrations for remote changes.
 */
export class Synchronizer {
	private readonly logger = createLogger('Synchronizer')

	private static readonly resolution = 10_000

	private readonly pacer = new SyncPacer(presence)

	/** One cycle at a time: a user coming online queues one of their own after the one running. */
	private readonly job = new BackgroundJob(this.logger, { every: Synchronizer.resolution }, () => this.cycle())

	constructor(private readonly orm: MikroORM) { }

	start() {
		this.logger.info(`Started synchronizer. Will poll watched integrations every ${SyncPacer.activeInterval / 1000}s, unwatched ones every ${SyncPacer.idleInterval / 60_000}min.`)
		presence.onOnline(userId => {
			this.logger.debug(`User ${userId} came online, syncing now, then polling every ${SyncPacer.activeInterval / 1000}s while connected`)
			void this.job.run(() => this.cycle({ userId }))
		})
		presence.onOffline(userId =>
			this.logger.debug(`User ${userId} went offline, polling relaxes to every ${SyncPacer.idleInterval / 60_000}min`))
		this.job.start()
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
		// Scope to sources so clients reconcile source states and clear import spinners.
		for (const changedUserId of changedUsers) {
			updates.dispatch(changedUserId, 'sources')
		}
	}
}

export const synchronizer = new Synchronizer(orm)
