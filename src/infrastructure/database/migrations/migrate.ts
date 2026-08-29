import { type MikroORM } from '@mikro-orm/sqlite'
import { User } from '../../../features/identity/User.js'
import { createLogger } from '../../logging/Logger.js'
import { migrations } from './index.js'

const logger = createLogger('Database')

/**
 * Execute pending database migrations, baselining legacy pre-migration instances.
 */
export async function migrate(orm: MikroORM) {
	const legacy = await isPreMigrationsDatabase(orm)
	if (legacy) {
		await orm.migrator.getStorage().logMigration({ name: migrations[0]!.name })
		logger.info('Baselined pre-migrations database: initial migration recorded as already applied')
	}

	try {
		const applied = await orm.migrator.up()
		if (applied.length > 0) {
			logger.info(`Applied ${applied.length} migration(s): ${applied.map(migration => migration.name).join(', ')}`)
		} else {
			logger.debug('Database schema is up to date')
		}
	} catch (error) {
		if (!legacy) {
			throw error
		}
		logger.warn(`Replaying migrations on this pre-migrations database failed (${error instanceof Error ? error.message : error}) — its schema predates the initial migration. Falling back to a wholesale schema sync; if sources look duplicated or stale afterwards, re-import the affected integrations.`)
		await orm.schema.update()
		const storage = orm.migrator.getStorage()
		for (const migration of migrations.slice(1)) {
			await storage.logMigration({ name: migration.name })
		}
	}
}

/** Check whether database contains entity tables without a MikroORM migrations log. */
async function isPreMigrationsDatabase(orm: MikroORM) {
	const tables = await orm.em.getConnection().execute<Array<{ name: string }>>('select name from sqlite_master where type = \'table\'')
	const names = new Set(tables.map(table => table.name))
	const migrationsTable = orm.config.get('migrations').tableName!
	return names.has(orm.getMetadata().get(User).tableName) && !names.has(migrationsTable)
}
