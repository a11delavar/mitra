import dotenv from 'dotenv'
import { MikroORM, UnderscoreNamingStrategy } from '@mikro-orm/sqlite'
import { User, Integration, CalDAV, Source, Entry } from '../shared/index.js'

dotenv.config({ path: `${import.meta.dirname}/.env` })

/** The shared ORM instance, initialized once at startup. Routes fork an `em` per request. */
export const orm = await MikroORM.init({
	entities: [User, Integration, CalDAV, Source, Entry],
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
