import { type EntityManager } from '@mikro-orm/sqlite'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { createLogger } from '../../infrastructure/logging/Logger.js'
import { Source } from '../../features/sources/Source.js'
import { Integration } from '../Integration.js'

/**
 * Background importer draining entries for newly enabled sources without blocking the API request.
 */
export class Importer {
	private readonly logger = createLogger('Importer')

	/** Maximum pagination passes allowed before yielding to background synchronizer. */
	private static readonly maxPasses = 20

	private readonly running = new Map<string, Promise<void>>()

	/** Starts background import for an integration's pending sources (joins existing task if running). */
	start(em: EntityManager, userId: string, integrationId: string): Promise<void> {
		const running = this.running.get(integrationId)
		if (running) {
			return running
		}
		const run = this.run(em.fork(), userId, integrationId)
			.catch(error => this.logger.error(`Import of integration ${integrationId} failed:`, error))
			.finally(() => this.running.delete(integrationId))
		this.running.set(integrationId, run)
		return run
	}

	private async run(em: EntityManager, userId: string, integrationId: string) {
		const integration = await em.findOne(Integration, { id: integrationId, userId })
		if (!integration) {
			return
		}
		const attempted = new Set<string>()
		for (;;) {
			const pending = (await em.find(Source, { integrationId, enabled: true, importedAt: null }, { refresh: true }))
				.filter(source => !attempted.has(source.id))
			if (!pending.length) {
				return
			}
			for (const source of pending) {
				attempted.add(source.id)
				await this.drain(integration, em, source, userId)
			}
		}
	}

	/** Syncs a source until fully imported or max passes reached, publishing updates after each pass. */
	private async drain(integration: Integration, em: EntityManager, source: Source, userId: string) {
		this.logger.debug(`Importing ${source.toString()}`)
		for (let pass = 1; source.importing; pass++) {
			try {
				// Holds lock per pass rather than whole import to avoid stalling concurrent writes.
				await Integration.exclusively(integration.id, async () => {
					await integration.syncSource(em, source)
					await em.flush()
				})
			} catch (error) {
				this.logger.warn(`Import of ${source.toString()} failed — the synchronizer retries it:`, error)
				return
			}
			syncEmitter.emit('updated', userId, 'sources')
			if (source.importing && pass >= Importer.maxPasses) {
				this.logger.warn(`Stopped importing ${source.toString()} after ${pass} passes — it never came back quiet`)
				return
			}
		}
		this.logger.info(`Imported ${source.toString()}`)
	}
}

export const importer = new Importer()
