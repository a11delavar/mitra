import { UnderscoreNamingStrategy, defineConfig } from '@mikro-orm/sqlite'
import { Migrator } from '@mikro-orm/migrations'
import { User } from '../../features/identity/User.js'
import { Source } from '../../features/sources/Source.js'
import { Recurrence } from '../../features/recurrence/Recurrence.js'
import { Integration } from '../../integrations/Integration.js'
import { Identity } from '../../features/identity/Identity.js'
import { EntryRelation } from '../../features/relations/EntryRelation.js'
import { Entry } from '../../features/entries/Entry.js'
import { CalDAV, GoogleCalendar, AppleCalendar, Notion } from '../../integrations/registerIntegrations.js'
import { Dev } from '../../integrations/dev/Dev.js'
import { NotificationSubscription } from '../../features/reminders/NotificationSubscription.js'
import { Session } from '../../features/identity/server/Session.js'
import { State } from './State.js'
import { migrations } from './migrations/index.js'

/**
 * The ORM configuration, shared between the app (orm.ts) and the migrations CLI (migrations/cli.ts) —
 * generated migrations are only correct when both see the same entities and naming strategy.
 *
 * The backend ships as a single esbuild bundle, so migrations can't be discovered on disk at runtime:
 * they are imported explicitly (`migrationsList`). `snapshot` stays off here because the migrator
 * otherwise re-introspects the schema after running migrations and writes a snapshot file next to the
 * production database — the CLI turns it back on for generation, where the snapshot belongs in git.
 */
export function ormConfig(dbName: string) {
	return defineConfig({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Notion, Dev, Source, Entry, Recurrence, EntryRelation, NotificationSubscription, Session, State],
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
