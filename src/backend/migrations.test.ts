import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { User } from '../shared/index.js'
import { ormConfig } from './ormConfig.js'
import { migrate } from './migrations/migrate.js'
import { migrations } from './migrations/index.js'

// The production boot path (see orm.ts): fresh installs build their schema by running the shipped
// migrations, instances predating migrations get baselined instead of crashing on `create table`,
// and a second boot must always be a no-op. Dev boots use `orm.schema.update()` and never touch this.

/** A private in-memory ORM on the production config — the real entity set, naming strategy and
 * migrations list — with the schema deliberately NOT created yet. */
function inMemoryOrm() {
	return MikroORM.init(ormConfig(':memory:'))
}

async function tableNames(orm: MikroORM) {
	// `sqlite_*` are SQLite's own bookkeeping tables (e.g. sqlite_sequence for autoincrement ids).
	const tables = await orm.em.getConnection().execute<Array<{ name: string }>>('select name from sqlite_master where type = \'table\' and name not like \'sqlite_%\'')
	return new Set(tables.map(table => table.name))
}

describe('migrate', () => {
	it('builds a fresh database by running every shipped migration', async () => {
		const orm = await inMemoryOrm()
		try {
			await migrate(orm)

			const executed = await orm.migrator.getStorage().executed()
			assert.deepEqual(executed, migrations.map(migration => migration.name))
			assert.deepEqual(await orm.migrator.getPending(), [])

			// The schema is actually usable, not just logged as such.
			const em = orm.em.fork()
			em.persist(new User({ username: 'fresh' }))
			await em.flush()
			assert.ok(await em.findOne(User, { username: 'fresh' }))
		} finally {
			await orm.close()
		}
	})

	it('produces the same tables as the dev schema sync', async () => {
		const [migrated, synced] = [await inMemoryOrm(), await inMemoryOrm()]
		try {
			await migrate(migrated)
			await synced.schema.update()

			const migratedTables = await tableNames(migrated)
			migratedTables.delete('mikro_orm_migrations')
			assert.deepEqual(migratedTables, await tableNames(synced))
		} finally {
			await migrated.close()
			await synced.close()
		}
	})

	it('baselines a pre-migrations database instead of re-running its DDL', async () => {
		const orm = await inMemoryOrm()
		try {
			// A legacy instance: schema built by `orm.schema.update()`, no migrations log, live data.
			await orm.schema.update()
			const em = orm.em.fork()
			em.persist(new User({ username: 'legacy' }))
			await em.flush()

			await migrate(orm) // would throw 'table already exists' if the initial migration ran

			assert.deepEqual(await orm.migrator.getStorage().executed(), migrations.map(migration => migration.name))
			assert.ok(await orm.em.fork().findOne(User, { username: 'legacy' }), 'baselining must preserve existing data')
		} finally {
			await orm.close()
		}
	})

	it('is a no-op on an already migrated database', async () => {
		const orm = await inMemoryOrm()
		try {
			await migrate(orm)
			const executed = await orm.migrator.getStorage().getExecutedMigrations()

			await migrate(orm)

			assert.deepEqual(await orm.migrator.getStorage().getExecutedMigrations(), executed)
		} finally {
			await orm.close()
		}
	})
})
