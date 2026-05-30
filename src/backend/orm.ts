import dotenv from 'dotenv'
import { MikroORM, UnderscoreNamingStrategy } from '@mikro-orm/sqlite'
import { User, Integration, CalDAV, Source, Entry } from '../shared/index.js'

dotenv.config({ path: `${import.meta.dirname}/.env` })

/** The shared ORM instance, initialized once at startup. Routes fork an `em` per request. */
export const orm = await MikroORM.init({
	entities: [User, Integration, CalDAV, Source, Entry],
	dbName: `${import.meta.dirname}/../../data/database.sqlite`,
	/**
	 * Standard snake_case naming, but without the redundant `_id` suffix that
	 * `mapToPk` relations would otherwise add. Our FK properties already end in
	 * `Id` (`sourceId`, `integrationId`, `userId`), so the column is simply the
	 * underscored property name (`source_id`) — consistent with every other column
	 * (`external_id`, `raw_data`) instead of the default doubled `source_id_id`.
	 */
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
