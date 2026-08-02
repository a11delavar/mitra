import { type MikroORM } from '@mikro-orm/sqlite'
import { User, createLogger } from '../../shared/index.js'
import { migrations } from './index.js'

const logger = createLogger('Database')

/**
 * Brings the database up to the current schema by applying pending migrations — the non-dev
 * counterpart of the `orm.schema.update()` sync that dev boots use (see orm.ts).
 *
 * Instances that predate migrations have the tables but no migrations log. Those are baselined once:
 * a final schema sync brings whatever release they were on — even one several versions behind — up to
 * the current entities, and every shipped migration is recorded as executed. From then on, only
 * migrations touch the schema.
 */
export async function migrate(orm: MikroORM) {
	if (await isPreMigrationsDatabase(orm)) {
		await orm.schema.update()
		const storage = orm.migrator.getStorage()
		for (const migration of migrations) {
			await storage.logMigration({ name: migration.name })
		}
		logger.info(`Baselined pre-migrations database: schema synchronized, ${migrations.length} migration(s) recorded as already applied`)
	}

	const applied = await orm.migrator.up()
	if (applied.length > 0) {
		logger.info(`Applied ${applied.length} migration(s): ${applied.map(migration => migration.name).join(', ')}`)
	} else {
		logger.debug('Database schema is up to date')
	}
}

/** A database with entity tables but no migrations log — built by `orm.schema.update()` before this
 * app version introduced migrations (or by a dev boot). */
async function isPreMigrationsDatabase(orm: MikroORM) {
	const tables = await orm.em.getConnection().execute<Array<{ name: string }>>('select name from sqlite_master where type = \'table\'')
	const names = new Set(tables.map(table => table.name))
	const migrationsTable = orm.config.get('migrations').tableName!
	return names.has(orm.getMetadata().get(User).tableName) && !names.has(migrationsTable)
}
