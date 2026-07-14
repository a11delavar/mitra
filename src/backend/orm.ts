import dotenv from 'dotenv'
import { MikroORM, UnderscoreNamingStrategy } from '@mikro-orm/sqlite'
import { User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Source, Entry, Recurrence, EntryRelation, createLogger, logEnabled } from '../shared/index.js'
import { Dev } from './Dev.js'
import { NotificationSubscription } from './NotificationSubscription.js'
import { Session } from './Session.js'

dotenv.config({ path: `${import.meta.dirname}/.env` })

const dbLogger = createLogger('Database')

/** The shared ORM instance, initialized once at startup. Routes fork an `em` per request. */
export const orm = await MikroORM.init({
	entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Dev, Source, Entry, Recurrence, EntryRelation, NotificationSubscription, Session],
	dbName: `${import.meta.dirname}/../../data/database.sqlite`,
	// SQL is the firehose — wired only when the operator asked for `trace`, and routed there. Left off
	// otherwise, so a normal boot emits no query noise.
	debug: logEnabled('trace'),
	...(logEnabled('trace') ? { logger: (message: string) => dbLogger.verbose(message) } : {}),
	namingStrategy: class extends UnderscoreNamingStrategy {
		override joinColumnName(propertyName: string) {
			return this.propertyToColumnName(propertyName)
		}

		override joinKeyColumnName(entityName: string) {
			return this.propertyToColumnName(entityName)
		}
	},
	allowGlobalContext: true,
})

await orm.schema.update()
dbLogger.debug('Schema synchronized')

// Every entry must be relatable: relationships target entry UIDs (shared/Relation.ts), so a row
// without one could never be linked to. Recovery order matters: a CalDAV row synced before the
// uid column was read still carries the AUTHORITATIVE UID inside its raw .ics — minting a random
// one there would be revoked by the next resource re-parse, dangling every relation authored
// against it meanwhile. So the raw UID wins; a random uid is only for rows with no .ics at all
// (Dev seeds, legacy local rows). Idempotent: only NULL uids are touched.
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
