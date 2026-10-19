import { UnderscoreNamingStrategy, defineConfig } from '@mikro-orm/sqlite'
import { Migrator } from '@mikro-orm/migrations'
import { User } from '../../features/identity/User.js'
import { Source } from '../../features/sources/Source.js'
import { Integration } from '../../integrations/Integration.js'
import { Identity } from '../../features/identity/Identity.js'
import { EntryRelation } from '../../features/relations/EntryRelation.js'
import { Entry } from '../../features/entries/Entry.js'
import { MitraCalendar, CalDAV, GoogleCalendar, AppleCalendar, IcsSubscription, Notion, Tempo } from '../../integrations/registerIntegrations.js'
import { Demo } from '../../integrations/demo/Demo.js'
import { NotificationSubscription } from '../../features/reminders/NotificationSubscription.js'
import { Session } from '../../features/identity/server/Session.js'
import { AccessToken } from '../../features/identity/AccessToken.js'
import { File } from '../../features/files/File.js'
import { EntryFile } from '../../features/entries/EntryFile.js'
import { State } from './State.js'
import { children } from '../model/children.js'
import { migrations, nameOf } from './migrations/index.js'

/** ORM configuration shared between runtime (orm.ts) and migration CLI. */
export function ormConfig(dbName: string) {
	return defineConfig({
		entities: [User, Identity, Integration, MitraCalendar, Demo, CalDAV, GoogleCalendar, AppleCalendar, IcsSubscription, Notion, Tempo, Source, Entry, EntryRelation, NotificationSubscription, Session, AccessToken, File, EntryFile, State],
		subscribers: [children.subscriber],
		dbName,
		extensions: [Migrator],
		migrations: {
			migrationsList: migrations.map(migration => ({ name: nameOf(migration), class: migration })),
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
		// The domain holds no null: an empty column loads as an absent field, which saves as NULL again.
		forceUndefined: true,
	})
}
