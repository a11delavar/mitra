import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { EntryType, Source, User } from '../shared/index.js'
import { ormConfig } from './ormConfig.js'
import { migrate } from './migrations/migrate.js'
import { migrations } from './migrations/index.js'
import { Migration20260802230147_MergeSourceTypes } from './migrations/Migration20260802230147_MergeSourceTypes.js'

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

	it('replays cleanly onto a database born on the CURRENT entities (a dev schema.update build)', async () => {
		const orm = await inMemoryOrm()
		try {
			// Dev boots build their schema from today's entities, so a dev database that later boots in
			// production already HAS whatever the newer migrations create. `migrate` catches a failed
			// replay and falls back to a wholesale sync, which still satisfies the baselining test above —
			// so the replay is exercised directly here, where a failure can't be papered over. Every
			// migration after the initial one must therefore introspect and no-op on the new shape.
			await orm.schema.update()
			await orm.migrator.getStorage().logMigration({ name: migrations[0]!.name })

			await orm.migrator.up()

			assert.deepEqual(await orm.migrator.getPending(), [])
			assert.deepEqual(await orm.migrator.getStorage().executed(), migrations.map(migration => migration.name))
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
			// A real pre-migrations instance: the last pre-migrations release's schema — exactly what the
			// initial migration creates — with live data and no migrations log. The initial migration's SQL
			// is executed directly rather than via the migrator, which would create (and cache) the log table.
			const sql = (query: string) => orm.em.getConnection().execute(query)
			const initial = new (migrations[0]!)(orm.em.getDriver() as never, orm.config)
			await initial.up()
			for (const query of initial.getQueries()) {
				await sql(query as string)
			}

			await sql('insert into user (id, username) values (\'u1\', \'someone\')')
			await sql('insert into integration (id, user_id, uri, type, credentials) values (\'i1\', \'u1\', \'caldav://example\', \'caldav\', \'{}\')')
			// An event/task sibling pair for one collection (the old CalDAV discovery shape) — the enabled
			// event row must survive and inherit the pair — plus a single-type source that must stay untouched.
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
			assert.equal(merged.syncState ?? null, null, 'merged sibling tokens are void — the next sync re-lists')

			const solo = sources[1]!
			assert.deepEqual([...solo.entryTypes], [EntryType.Task])
			assert.deepEqual(solo.syncState, { token: 'solo' }, 'an unmerged source keeps its token')

			const entries = await sql('select id, source_id from entry order by id') as Array<{ id: string, source_id: string }>
			assert.deepEqual(entries, [
				{ id: 'e1', source_id: 's-event' },
				{ id: 'e2', source_id: 's-event' },
				{ id: 'e3', source_id: 's-solo' },
			], 'the sibling\'s entries re-point; nothing is lost')

			assert.deepEqual(await orm.migrator.getStorage().executed(), migrations.map(migration => migration.name))
			assert.deepEqual(await orm.migrator.getPending(), [])
		} finally {
			await orm.close()
		}
	})

	it('splits merged collections back apart on migration down', async () => {
		const orm = await inMemoryOrm()
		try {
			await migrate(orm)
			const sql = (query: string) => orm.em.getConnection().execute(query)
			await sql('insert into user (id, username) values (\'u1\', \'someone\')')
			await sql('insert into integration (id, user_id, uri, type, credentials) values (\'i1\', \'u1\', \'caldav://example\', \'caldav\', \'{}\')')
			await sql('insert into source (id, integration_id, uri, entry_types, name, enabled, hidden) values (\'s1\', \'i1\', \'https://example/cal\', \'["event","task"]\', \'Calendar\', 1, 0)')
			await sql('insert into entry (id, source_id, uri, type) values (\'e1\', \'s1\', \'https://example/cal/1.ics\', \'event\')')
			await sql('insert into entry (id, source_id, uri, type) values (\'e2\', \'s1\', \'https://example/cal/2.ics\', \'task\')')

			// Named, not a bare `down()`: that reverts whatever is LAST, so this stopped testing the split
			// the day a migration was appended after the merge.
			await orm.migrator.down({ migrations: [Migration20260802230147_MergeSourceTypes.name] })

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
