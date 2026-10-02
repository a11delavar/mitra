import { type EntityManager } from '@mikro-orm/sqlite'
import { orm } from '../../../infrastructure/database/orm.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { Integration } from '../../../integrations/Integration.js'
import { Source } from '../../sources/Source.js'
import { type Entry } from '../../entries/Entry.js'

const logger = createLogger('Availability')

const reason = (error: unknown) => error instanceof Error ? error.message : String(error)

/** Runs in the background, so a failing remote never fails the request that changed something. */
function inBackground(work: (em: EntityManager) => Promise<void>) {
	const em = orm.em.fork()
	void work(em).then(() => em.flush()).catch((error: unknown) => logger.warn(`Publishing availability failed: ${reason(error)}`))
}

async function publishTo(em: EntityManager, userId: string, integrationIds: ReadonlyArray<string>) {
	for (const integration of await em.find(Integration, { id: { $in: integrationIds }, userId })) {
		await integration.publishAvailability(em).catch((error: unknown) =>
			logger.warn(`Publishing availability to ${integration.toString()} failed: ${reason(error)}`))
	}
}

/** Hands each of the integrations the availability in its calendars, so it can decide what reaches its provider. */
export function publishAvailability(userId: string, integrationIds: Iterable<string>): void {
	const ids = [...new Set(integrationIds)]
	if (ids.length) {
		inBackground(em => publishTo(em, userId, ids))
	}
}

/** Calls {@link publishAvailability} for the integrations holding the changed entries that are availability. */
export function availabilityChanged(userId: string, ...entries: ReadonlyArray<Pick<Entry, 'type' | 'sourceId'> | undefined>): void {
	const sourceIds = [...new Set(entries.flatMap(entry => entry?.type?.isAvailability ? [entry.sourceId] : []))]
	if (sourceIds.length) {
		inBackground(async em => publishTo(em, userId, (await em.find(Source, { id: { $in: sourceIds } })).map(source => source.integrationId)))
	}
}
