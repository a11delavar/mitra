import dotenv from 'dotenv'
import { MikroORM } from '@mikro-orm/sqlite'
import { Entry } from '#features/entries'
import { createLogger, logEnabled } from '#infrastructure/logging/Logger.js'
import { ormConfig } from './ormConfig.js'
import { migrate } from './migrations/migrate.js'

dotenv.config({ path: `${import.meta.dirname}/.env`, quiet: true })

const dbLogger = createLogger('Database')

/** The shared ORM instance, initialized once at startup. */
export const orm = await MikroORM.init({
	// `node --test` runs each test file in a process of its own (`NODE_TEST_CONTEXT`), which keeps a database of its own in memory.
	...ormConfig(process.env.NODE_TEST_CONTEXT ? ':memory:' : `${import.meta.dirname}/../../data/database.sqlite`),
	debug: logEnabled('trace'),
	...(logEnabled('trace') ? { logger: (message: string) => dbLogger.verbose(message) } : {}),
})

await migrate(orm)

// Backfill missing UIDs for legacy rows using raw .ics UID when available.
{
	const uidless = await orm.em.find(Entry, { uid: null })
	if (uidless.length) {
		for (const entry of uidless) {
			const raw = entry.data?.raw?.replace(/\r?\n[ \t]/g, '')
			entry.uid = (raw ? /^UID(?:;[^:\r\n]*)?:[ \t]*(.+?)[ \t]*$/m.exec(raw)?.[1] : undefined) || crypto.randomUUID()
		}
		await orm.em.flush()
		dbLogger.debug(`Backfilled uids for ${uidless.length} entries`)
	}
	orm.em.clear()
}
