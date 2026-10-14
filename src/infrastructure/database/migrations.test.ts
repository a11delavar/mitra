import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { User } from '../../features/identity/User.js'
import { Source } from '../../features/sources/Source.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { ormConfig } from './ormConfig.js'
import { migrate } from './migrations/migrate.js'
import { migrations, nameOf } from './migrations/index.js'
import { Migration20260802230147_MergeSourceTypes } from './migrations/Migration20260802230147_MergeSourceTypes.js'

// Every boot runs the shipped migrations: fresh databases build their schema with them, instances predating migrations
// get baselined instead of crashing on `create table`, and a second boot is a no-op.

/** An in-memory ORM on the real config, its schema not created yet. */
function inMemoryOrm() {
	return MikroORM.init(ormConfig(':memory:'))
}

describe('migrate', () => {
	it('builds a fresh database by running every shipped migration', async () => {
		const orm = await inMemoryOrm()
		try {
			await migrate(orm)

			const executed = await orm.migrator.getStorage().executed()
			assert.deepEqual(executed, migrations.map(nameOf))
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

	// Constraints aside: the initial migration's CHECK on the integration discriminator stays, as dropping it rebuilds a
	// table whose drop cascades to every source.
	it('builds every table the entities declare, column by column', async () => {
		const [migrated, synced] = [await inMemoryOrm(), await inMemoryOrm()]
		try {
			await migrate(migrated)
			await synced.schema.update()
			const columnsOf = async (orm: MikroORM) => {
				const tables = await orm.em.getConnection().execute<Array<{ name: string }>>('select name from sqlite_master where type = \'table\' and name not like \'sqlite_%\' and name != \'mikro_orm_migrations\' order by name')
				return Promise.all(tables.map(async ({ name }) => [name, await orm.em.getConnection().execute(`select name, type, "notnull" from pragma_table_info('${name}') order by name`)]))
			}
			assert.deepEqual(await columnsOf(migrated), await columnsOf(synced))
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

			assert.deepEqual(await orm.migrator.getStorage().executed(), migrations.map(nameOf))
			assert.ok(await orm.em.fork().findOne(User, { username: 'legacy' }), 'baselining must preserve existing data')
		} finally {
			await orm.close()
		}
	})

	it('moves a device\'s locale out of the column named for languages', async () => {
		const orm = await inMemoryOrm()
		try {
			const connection = orm.em.getConnection()
			await orm.migrator.up({ to: 'Migration20261003010248_EntryRank' })
			await connection.execute('insert into `user` (`id`, `username`) values (\'u\', \'legacy\')')
			await connection.execute('insert into `notification_subscription` (`id`, `endpoint`, `keys`, `user_id`, `language`) values (\'s\', \'e\', \'{}\', \'u\', \'en-GB\')')

			await orm.migrator.up()

			const columns = await connection.execute<Array<{ name: string }>>('select name from pragma_table_info(\'notification_subscription\')')
			assert.ok(!columns.some(column => column.name === 'language'))
			assert.deepEqual(await connection.execute('select `locale` from `notification_subscription`'), [{ locale: 'en-GB' }])
		} finally {
			await orm.close()
		}
	})

	it('renames what earlier builds logged under esbuild\'s names, so nothing runs twice', async () => {
		const orm = await inMemoryOrm()
		try {
			await migrate(orm)
			const connection = orm.em.getConnection()
			await connection.execute('update `mikro_orm_migrations` set name = \'_\' || name where name like \'%Device%\' or name like \'%DueAndEstimate\'')

			await migrate(orm)

			assert.deepEqual(await orm.migrator.getStorage().executed(), migrations.map(nameOf))
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

	it('replays the source-type merge when baselining the previous release\'s schema', async () => {
		const orm = await inMemoryOrm()
		try {
			// A real pre-migrations instance: the last pre-migrations release's schema (exactly what the
			// initial migration creates) with live data and no migrations log. The initial migration's SQL
			// is executed directly rather than via the migrator, which would create (and cache) the log table.
			const sql = (query: string) => orm.em.getConnection().execute(query)
			const initial = new (migrations[0]!)(orm.em.getDriver() as never, orm.config)
			await initial.up()
			for (const query of initial.getQueries()) {
				await sql(query as string)
			}

			await sql('insert into user (id, username) values (\'u1\', \'someone\')')
			await sql('insert into integration (id, user_id, uri, type, credentials) values (\'i1\', \'u1\', \'caldav://example\', \'caldav\', \'{}\')')
			// An event/task sibling pair for one collection (the old CalDAV discovery shape). The enabled
			// event row must survive and inherit the pair, plus a single-type source that must stay untouched.
			await sql('insert into source (id, integration_id, uri, type, name, enabled, hidden, sync_state) values (\'s-event\', \'i1\', \'https://example/cal\', \'event\', \'Calendar\', 1, 0, \'{"token":"e"}\')')
			await sql('insert into source (id, integration_id, uri, type, name, enabled, hidden, sync_state) values (\'s-task\', \'i1\', \'https://example/cal\', \'task\', \'Calendar\', 0, 1, \'{"token":"t"}\')')
			await sql('insert into source (id, integration_id, uri, type, name, enabled, hidden, sync_state) values (\'s-solo\', \'i1\', \'https://example/todos\', \'task\', \'Todos\', 1, 0, \'{"token":"solo"}\')')
			await sql('insert into entry (id, source_id, uri, type) values (\'e1\', \'s-event\', \'https://example/cal/1.ics\', \'event\')')
			await sql('insert into entry (id, source_id, uri, type) values (\'e2\', \'s-task\', \'https://example/cal/2.ics\', \'task\')')
			await sql('insert into entry (id, source_id, uri, type) values (\'e3\', \'s-solo\', \'https://example/todos/3.ics\', \'task\')')

			await migrate(orm)

			const sources = await orm.em.fork().find(Source, {}, { orderBy: { id: 'asc' } })
			assert.deepEqual(sources.map(source => source.id), ['s-event', 's-solo'], 'the task sibling merges into the surviving event row')

			const merged = sources[0]!
			assert.deepEqual([...merged.entryTypes], [EntryType.Event, EntryType.Task])
			assert.equal(merged.enabled, true, 'either sibling on show means the collection is')
			assert.equal(merged.hidden, false)
			assert.equal(merged.syncState ?? null, null, 'merged sibling tokens are void, the next sync re-lists')

			const solo = sources[1]!
			assert.deepEqual([...solo.entryTypes], [EntryType.Task])
			assert.deepEqual(solo.syncState, { token: 'solo' }, 'an unmerged source keeps its token')

			const entries = await sql('select id, source_id from entry order by id') as Array<{ id: string, source_id: string }>
			assert.deepEqual(entries, [
				{ id: 'e1', source_id: 's-event' },
				{ id: 'e2', source_id: 's-event' },
				{ id: 'e3', source_id: 's-solo' },
			], 'the sibling\'s entries re-point; nothing is lost')

			assert.deepEqual(await orm.migrator.getStorage().executed(), migrations.map(nameOf))
			assert.deepEqual(await orm.migrator.getPending(), [])
		} finally {
			await orm.close()
		}
	})

	it('splits merged collections back apart on migration down', async () => {
		const orm = await inMemoryOrm()
		try {
			// Up to the merge alone, as a rollback reverts every later migration first.
			await orm.migrator.up({ to: nameOf(Migration20260802230147_MergeSourceTypes) })
			const sql = (query: string) => orm.em.getConnection().execute(query)
			await sql('insert into user (id, username) values (\'u1\', \'someone\')')
			await sql('insert into integration (id, user_id, uri, type, credentials) values (\'i1\', \'u1\', \'caldav://example\', \'caldav\', \'{}\')')
			await sql('insert into source (id, integration_id, uri, entry_types, name, enabled, hidden) values (\'s1\', \'i1\', \'https://example/cal\', \'["event","task"]\', \'Calendar\', 1, 0)')
			await sql('insert into entry (id, source_id, uri, type) values (\'e1\', \'s1\', \'https://example/cal/1.ics\', \'event\')')
			await sql('insert into entry (id, source_id, uri, type) values (\'e2\', \'s1\', \'https://example/cal/2.ics\', \'task\')')

			// Named, not a bare `down()`: that reverts whatever is LAST, so this stopped testing the split
			// the day a migration was appended after the merge.
			await orm.migrator.down({ migrations: [nameOf(Migration20260802230147_MergeSourceTypes)] })

			const sources = await sql('select id, uri, type from source order by type') as Array<{ id: string, uri: string, type: string }>
			assert.equal(sources.length, 2, 'a both-types collection becomes an event/task sibling pair again')
			assert.deepEqual(sources.map(source => source.type), ['event', 'task'])
			assert.equal(sources[0]!.id, 's1', 'the merged row stays the event source')
			assert.equal(sources[1]!.uri, 'https://example/cal')

			const entries = await sql('select id, source_id from entry order by id') as Array<{ id: string, source_id: string }>
			assert.equal(entries[0]!.source_id, 's1')
			assert.equal(entries[1]!.source_id, sources[1]!.id, 'task entries move to the re-created task sibling')
		} finally {
			await orm.close()
		}
	})
})
