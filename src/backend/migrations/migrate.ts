import { type MikroORM } from '@mikro-orm/sqlite'
import { User, createLogger } from '../../shared/index.js'
import { migrations } from './index.js'

const logger = createLogger('Database')

/**
 * Brings the database up to the current schema by applying pending migrations — the non-dev
 * counterpart of the `orm.schema.update()` sync that dev boots use (see orm.ts).
 *
 * Instances that predate migrations have the tables but no migrations log. Their schema was built by
 * a release's `schema.update()`, and the initial migration IS that schema (generated from the last
 * pre-migrations entities) — so it is recorded as applied without running, and every migration after
 * it replays for real. That replay is the point: later migrations carry DATA transformations (merging
 * source-type sibling rows, say) that a wholesale schema sync would silently skip.
 *
 * Only a schema too old for that replay (a straggler several releases behind, missing columns the
 * migrations touch) falls back to one final schema sync with everything recorded as applied: the
 * instance boots and the schema is right, but the skipped transformations may leave artifacts —
 * re-importing the affected integrations is the recovery, per the project's standing convention.
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
			throw error // a failing migration on a migrated instance is a bug to surface, never to paper over
		}
		logger.warn(`Replaying migrations on this pre-migrations database failed (${error instanceof Error ? error.message : error}) — its schema predates the initial migration. Falling back to a wholesale schema sync; if sources look duplicated or stale afterwards, re-import the affected integrations.`)
		await orm.schema.update()
		const storage = orm.migrator.getStorage()
		for (const migration of migrations.slice(1)) {
			await storage.logMigration({ name: migration.name })
		}
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
