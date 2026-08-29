import { UnderscoreNamingStrategy, defineConfig } from '@mikro-orm/sqlite'
import { Migrator } from '@mikro-orm/migrations'
import { User } from '../../features/identity/User.js'
import { Source } from '../../features/sources/Source.js'
import { Recurrence } from '../../features/recurrence/Recurrence.js'
import { Integration } from '../../integrations/Integration.js'
import { Identity } from '../../features/identity/Identity.js'
import { EntryRelation } from '../../features/relations/EntryRelation.js'
import { Entry } from '../../features/entries/Entry.js'
import { CalDAV, GoogleCalendar, AppleCalendar, IcsSubscription, Notion, Tempo } from '../../integrations/registerIntegrations.js'
import { Dev } from '../../integrations/dev/Dev.js'
import { NotificationSubscription } from '../../features/reminders/NotificationSubscription.js'
import { Session } from '../../features/identity/server/Session.js'
import { State } from './State.js'
import { migrations } from './migrations/index.js'

/** ORM configuration shared between runtime (orm.ts) and migration CLI. */
export function ormConfig(dbName: string) {
	return defineConfig({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, IcsSubscription, Notion, Tempo, Dev, Source, Entry, Recurrence, EntryRelation, NotificationSubscription, Session, State],
		dbName,
		extensions: [Migrator],
		migrations: {
			migrationsList: migrations,
			snapshot: false,
		},
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
}
