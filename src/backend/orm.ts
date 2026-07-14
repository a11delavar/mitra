import dotenv from 'dotenv'
import { MikroORM, UnderscoreNamingStrategy } from '@mikro-orm/sqlite'
import { User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Notion, Source, Entry, Recurrence, createLogger, logEnabled } from '../shared/index.js'
import { Dev } from './Dev.js'
import { NotificationSubscription } from './NotificationSubscription.js'
import { Session } from './Session.js'

dotenv.config({ path: `${import.meta.dirname}/.env` })

const dbLogger = createLogger('Database')

/** The shared ORM instance, initialized once at startup. Routes fork an `em` per request. */
export const orm = await MikroORM.init({
	entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Notion, Dev, Source, Entry, Recurrence, NotificationSubscription, Session],
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
