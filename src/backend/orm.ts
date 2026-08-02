import dotenv from 'dotenv'
import { MikroORM } from '@mikro-orm/sqlite'
import { createLogger, logEnabled } from '../shared/index.js'
import { ormConfig } from './ormConfig.js'
import { migrate } from './migrations/migrate.js'

dotenv.config({ path: `${import.meta.dirname}/.env`, quiet: true })

const dbLogger = createLogger('Database')

/** The shared ORM instance, initialized once at startup. Routes fork an `em` per request. */
export const orm = await MikroORM.init({
	...ormConfig(`${import.meta.dirname}/../../data/database.sqlite`),
	// SQL is the firehose — wired only when the operator asked for `trace`, and routed there. Left off
	// otherwise, so a normal boot emits no query noise.
	debug: logEnabled('trace'),
	...(logEnabled('trace') ? { logger: (message: string) => dbLogger.verbose(message) } : {}),
})

// Dev hops between branches and worktrees whose entities drift in every direction, so its schema is
// synchronized by diff on each boot. Everywhere else the shipped migrations carry the database
// forward release by release (baselining instances that predate them — see migrations/migrate.ts).
if (process.env.MITRA_DEV === 'true') {
	await orm.schema.update()
	dbLogger.debug('Schema synchronized')
} else {
	await migrate(orm)
}
