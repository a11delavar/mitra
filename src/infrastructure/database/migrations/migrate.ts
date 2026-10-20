import { MikroORM } from '@mikro-orm/sqlite'
import { User } from '#features/identity'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { ormConfig } from '../ormConfig.js'
import { migrations, nameOf } from './index.js'

const logger = createLogger('Database')

/**
 * Execute pending database migrations, baselining legacy pre-migration instances.
 */
export async function migrate(orm: MikroORM) {
	await dropEsbuildPrefixes(orm)
	const legacy = await isPreMigrationsDatabase(orm)
	if (legacy) {
		const place = await placeInChain(orm)
		for (const migration of migrations.slice(0, place + 1)) {
			await orm.migrator.getStorage().logMigration({ name: nameOf(migration) })
		}
		logger.info(`Baselined a database without the migration log: its tables are those ${nameOf(migrations[place]!)} leaves, so the chain resumes after it`)
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
		logger.warn(`Replaying migrations on this pre-migrations database failed (${error instanceof Error ? error.message : error}): its schema predates the initial migration. Falling back to a wholesale schema sync; if sources look duplicated or stale afterwards, re-import the affected integrations.`)
		await orm.schema.update()
		const storage = orm.migrator.getStorage()
		for (const migration of migrations.slice(1)) {
			await storage.logMigration({ name: nameOf(migration) })
		}
	}
}

/** Earlier builds logged esbuild's names for the classes that refer to themselves, which a name from its file would run again. */
async function dropEsbuildPrefixes(orm: MikroORM) {
	const table = orm.config.get('migrations').tableName!
	const [log] = await orm.em.getConnection().execute<Array<{ name: string }>>('select name from sqlite_master where type = \'table\' and name = ?', [table])
	if (log) {
		await orm.em.getConnection().execute(`update \`${table}\` set name = substr(name, 2) where substr(name, 1, 1) = '_'`)
	}
}

/**
 * The last migration whose tables a database built without the log already has, found by replaying the chain in memory:
 * dev databases were built from the entities, and a schema sync in place of the migrations after it loses their data.
 * A migration that only moves data counts from where its shape began, so it still runs.
 */
async function placeInChain(orm: MikroORM) {
	const tables = await tablesOf(orm)
	const config = ormConfig(':memory:')
	const replay = await MikroORM.init({ ...config, migrations: { ...config.migrations, silent: true } })
	try {
		let place = 0
		let previous = ''
		for (const [index, migration] of migrations.entries()) {
			await replay.migrator.up({ to: nameOf(migration) })
			const step = await tablesOf(replay)
			const shape = JSON.stringify([...step].map(([table, columns]) => [table, [...columns]]))
			if (shape !== previous && [...step].every(([table, columns]) => [...columns].every(column => tables.get(table)?.has(column)))) {
				place = index
			}
			previous = shape
		}
		return place
	} finally {
		await replay.close()
	}
}

async function tablesOf(orm: MikroORM) {
	const connection = orm.em.getConnection()
	const tables = await connection.execute<Array<{ name: string }>>(`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name != ? order by name`, [orm.config.get('migrations').tableName!])
	return new Map(await Promise.all(tables.map(async ({ name }) => [name, new Set((await connection.execute<Array<{ name: string }>>(`select name from pragma_table_info('${name}') order by name`)).map(column => column.name))] as const)))
}

/** Check whether database contains entity tables without a MikroORM migrations log. */
async function isPreMigrationsDatabase(orm: MikroORM) {
	const tables = await orm.em.getConnection().execute<Array<{ name: string }>>('select name from sqlite_master where type = \'table\'')
	const names = new Set(tables.map(table => table.name))
	const migrationsTable = orm.config.get('migrations').tableName!
	return names.has(orm.getMetadata().get(User).tableName) && !names.has(migrationsTable)
}
