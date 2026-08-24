import dotenv from 'dotenv'
import { MikroORM } from '@mikro-orm/sqlite'
import { createLogger, logEnabled } from '../logging/Logger.js'
import { Entry } from '../../features/entries/Entry.js'
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

// Every entry must be relatable: relationships target entry UIDs (features/relations/Relation.ts), so a row
// without one could never be linked to. Recovery order matters: a CalDAV row synced before the
// uid column was read still carries the AUTHORITATIVE UID inside its raw .ics — minting a random
// one there would be revoked by the next resource re-parse, dangling every relation authored
// against it meanwhile. So the raw UID wins; a random uid is only for rows with no .ics at all
// (Dev seeds, legacy local rows). Idempotent: only NULL uids are touched.
//
// A boot step rather than a migration, on purpose: it has to reach BOTH schema paths above (dev
// never runs migrations), and it reads `data.raw` — application knowledge a SQL migration has no
// business re-implementing. Being idempotent, running it on every boot costs one indexed query.
{
	const uidless = await orm.em.find(Entry, { uid: null })
	if (uidless.length) {
		for (const entry of uidless) {
			// Unfold first (RFC 5545 folds long lines with CRLF + space), then read the UID line.
			const raw = entry.data?.raw?.replace(/\r?\n[ \t]/g, '')
			entry.uid = (raw ? /^UID(?:;[^:\r\n]*)?:[ \t]*(.+?)[ \t]*$/m.exec(raw)?.[1] : undefined) || crypto.randomUUID()
		}
		await orm.em.flush()
		dbLogger.debug(`Backfilled uids for ${uidless.length} entries`)
	}
	orm.em.clear()
}
