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

			let hasChanges = false
			for (const integration of integrations) {
				this.logger.debug(`Syncing ${integration.toString()}`)
				if (await integration.sync(em)) {
					hasChanges = true
				}
			}

			await em.flush()
			if (hasChanges) {
				syncEmitter.emit('updated')
			}
		} catch (error) {
			this.logger.error('Sync failed:', error)
		} finally {
			this.syncing = false
		}
	}
}
