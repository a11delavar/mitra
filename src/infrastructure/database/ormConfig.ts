import { UnderscoreNamingStrategy, defineConfig } from '@mikro-orm/sqlite'
import { Migrator } from '@mikro-orm/migrations'
import { User, Identity, AccessToken } from '#features/identity'
import { Source } from '#features/sources'
import { EntryRelation } from '#features/relations'
import { Entry, EntryFile } from '#features/entries'
import { NotificationSubscription } from '#features/reminders/NotificationSubscription.js'
import { Session } from '#features/identity/server/Session.js'
import { File } from '#features/files/File.js'
import { Integration } from '#integrations'
import { MitraCalendar, CalDAV, GoogleCalendar, AppleCalendar, IcsSubscription, Notion, Todoist, Tempo } from '#integrations/registerIntegrations.js'
import { Demo } from '#integrations/demo/Demo.js'
import { children } from '#infrastructure/model'
import { State } from './State.js'
import { migrations, nameOf } from './migrations/index.js'

/** ORM configuration shared between runtime (orm.ts) and migration CLI. */
export function ormConfig(dbName: string) {
	return defineConfig({
		entities: [User, Identity, Integration, MitraCalendar, Demo, CalDAV, GoogleCalendar, AppleCalendar, IcsSubscription, Notion, Todoist, Tempo, Source, Entry, EntryRelation, NotificationSubscription, Session, AccessToken, File, EntryFile, State],
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
