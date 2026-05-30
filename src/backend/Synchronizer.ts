import { type MikroORM } from '@mikro-orm/sqlite'
import { syncEmitter } from './server.js'
import { Integration, createLogger } from '../shared/index.js'

export class Synchronizer {
	private readonly logger = createLogger('Synchronizer')

	private static readonly interval = 10_000

	constructor(private readonly orm: MikroORM) { }

	async start() {
		this.logger.info(`Started synchronizer. Will synchronize every ${Synchronizer.interval / 1000}s.`)
		await this.syncAll()
		setInterval(() => this.syncAll(), Synchronizer.interval)
	}

	private async syncAll() {
		try {
			const em = this.orm.em.fork()
			const integrations = await em.find(Integration, {})

			for (const integration of integrations) {
				this.logger.debug(`Syncing ${integration.toString()}`)
				await integration.sync(em)
			}

			const unitOfWork = em.getUnitOfWork()
			unitOfWork.computeChangeSets()
			const hasChanges = unitOfWork.getChangeSets().length > 0

			await em.flush()
			if (hasChanges) {
				syncEmitter.emit('updated')
			}
		} catch (error) {
			this.logger.error('Sync failed:', error)
		}
	}
}
