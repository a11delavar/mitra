import dotenv from 'dotenv'
import { MikroORM, UnderscoreNamingStrategy } from '@mikro-orm/sqlite'
import { User, Integration, CalDAV, Source, Entry } from '../shared/index.js'
import { Dev } from './Dev.js'

dotenv.config({ path: `${import.meta.dirname}/.env` })

/** The shared ORM instance, initialized once at startup. Routes fork an `em` per request. */
export const orm = await MikroORM.init({
	entities: [User, Integration, CalDAV, Dev, Source, Entry],
	dbName: `${import.meta.dirname}/../../data/database.sqlite`,
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

// Backfill recurrence fields for entries synced before recurrence support: their raw .ics already carries
// the RRULE / RECURRENCE-ID, but those columns are new (NULL) and the sync's etag-skip won't re-read an
// unchanged member. Parse only the candidates (raw mentions a recurrence property, columns still unset),
// then link overrides to their masters by UID. Idempotent — once populated, later boots are no-ops.
{
	const em = orm.em.fork()
	const entries = await em.find(Entry, {})
	let backfilled = false
	for (const entry of entries) {
		if (entry.rrule || entry.recurrenceId || !entry.data?.raw) {
			continue
		}
		if (!entry.data.raw.includes('RRULE') && !entry.data.raw.includes('RECURRENCE-ID')) {
			continue
		}
		const recurrence = CalDAV.parseRecurrence(entry.data.raw)
		entry.uid = recurrence.uid
		entry.rrule = recurrence.rrule
		entry.recurrenceId = recurrence.recurrenceId as unknown as DateTime
		backfilled = true
	}
	if (backfilled) {
		for (const entry of entries) {
			if (entry.recurrenceId && entry.uid && !entry.recurrenceMasterId) {
				const master = entries.find(m => m.rrule && !m.recurrenceId && m.uid === entry.uid && m.sourceId === entry.sourceId)
				if (master) {
					entry.recurrenceMasterId = master.id
				}
			}
		}
		await em.flush()
	}
}
