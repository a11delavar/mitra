import dotenv from 'dotenv'
import { MikroORM } from '@mikro-orm/sqlite'
import { createLogger, logEnabled } from '../logging/Logger.js'
import { Entry } from '../../features/entries/Entry.js'
import { ormConfig } from './ormConfig.js'
import { migrate } from './migrations/migrate.js'

dotenv.config({ path: `${import.meta.dirname}/.env`, quiet: true })

const dbLogger = createLogger('Database')

/** The shared ORM instance, initialized once at startup. */
export const orm = await MikroORM.init({
	...ormConfig(`${import.meta.dirname}/../../data/database.sqlite`),
	debug: logEnabled('trace'),
	...(logEnabled('trace') ? { logger: (message: string) => dbLogger.verbose(message) } : {}),
})

if (process.env.MITRA_DEV === 'true') {
	await orm.schema.update()
	dbLogger.debug('Schema synchronized')
} else {
	await migrate(orm)
}

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
