import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { ormConfig } from '#infrastructure/database/ormConfig.js'
import { migrate } from '#infrastructure/database/migrations/migrate.js'
import { Backfill } from '#infrastructure/database/Backfill.js'
import { RecognizeStoredEntries } from './RecognizeStoredEntries.js'

describe('RecognizeStoredEntries', () => {
	let orm: MikroORM
	before(async () => {
		orm = await MikroORM.init(ormConfig(':memory:'))
		await migrate(orm)
	})
	after(() => orm.close())

	const day = 86_400_000
	const start = Date.parse('2026-03-02T07:00:00Z')
	const query = <T>(sql: string, parameters: Array<unknown> = []) => orm.em.getConnection().execute(sql, parameters) as Promise<Array<T>>
	const asked = async () => (await query<{ key: string }>('select `key` from `state` where `key` like \'backfill:%\'')).map(row => row.key)

	it('places the entries stored before routines were kept, once, leaving calendars that can only be read', async () => {
		await query('insert into `user` (`id`, `username`, `time_zones`) values (\'u\', \'legacy\', \'{"home":{"id":"Europe/Berlin"}}\')')
		await query('insert into `integration` (`id`, `user_id`, `uri`, `type`, `credentials`) values (\'i\', \'u\', \'mitra://local\', \'mitra\', \'{}\')')
		for (const id of ['home', 'work', 'feed']) {
			await query('insert into `source` (`id`, `integration_id`, `uri`, `entry_types`, `name`, `enabled`, `hidden`, `read_only`) values (?, \'i\', ?, \'["event","task"]\', ?, 1, 0, ?)', [id, `mitra://local/${id}`, id, id === 'feed' ? 1 : null])
		}
		// Written past the model, as the entries of an older version are: none was placed as it was stored.
		const entry = (id: string, source: string, heading: string, at: number, recurrence?: string) =>
			query('insert into `entry` (`id`, `uid`, `source_id`, `type`, `heading`, `start`, `end`, `all_day`, `recurrence`) values (?, ?, ?, \'event\', ?, ?, ?, 0, ?)', [id, id, source, heading, at, at + 3_600_000, recurrence ?? null])
		await entry('stretch', 'home', 'Stretch', start, 'FREQ=DAILY')
		await entry('stretch-done', 'home', ' stretch', start + day)
		// An occurrence another app renamed is still one of the recurring entry's dates.
		await query('insert into `entry` (`id`, `uid`, `source_id`, `type`, `heading`, `start`, `end`, `all_day`, `recurring_entry_id`, `recurrence_id`) values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)', ['stretch-park', 'stretch', 'home', 'event', 'Stretch in the park', start + 2 * day, start + 2 * day + 3_600_000, 'stretch', start + 2 * day])
		await entry('stretch-work', 'work', 'Stretch', start, 'FREQ=DAILY')
		await entry('stretch-feed', 'feed', 'Stretch', start, 'FREQ=DAILY')
		await entry('birthday', 'home', 'Birthday', start, 'FREQ=YEARLY')
		await entry('accounting', 'home', 'Accounting', start, 'FREQ=WEEKLY;COUNT=3')
		for (const index of [0, 1, 2, 3]) {
			await entry(`haircut-${index}`, 'home', 'Haircut', start + index * 35 * day)
		}
		for (const index of [0, 1, 2]) {
			await entry(`lunch-${index}`, 'home', 'Lunch', start + index * 7 * day)
		}
		assert.deepEqual(await asked(), ['backfill:recognize-stored-entries'])

		await Backfill.runAsked(orm, [new RecognizeStoredEntries()])

		const rows = await query<{ id: string, routine_id: string | null }>('select `id`, `routine_id` from `entry`')
		const routineOf = (id: string) => rows.find(row => row.id === id)!.routine_id
		assert.deepEqual(['accounting', 'lunch-0', 'stretch-feed'].map(routineOf), [null, null, null])
		assert.ok(routineOf('birthday'))
		assert.equal(routineOf('stretch-done'), routineOf('stretch'))
		assert.equal(routineOf('stretch-park'), routineOf('stretch'))
		assert.notEqual(routineOf('stretch-work'), routineOf('stretch'))
		assert.equal(new Set([0, 1, 2, 3].map(index => routineOf(`haircut-${index}`))).size, 1)
		const routines = await query<{ id: string, source_id: string }>('select `id`, `source_id` from `routine`')
		assert.deepEqual(routines.map(routine => routine.source_id).sort(), ['home', 'home', 'home', 'work'])
		assert.deepEqual(new Set(routines.map(routine => routine.id)), new Set(rows.flatMap(row => row.routine_id ?? [])))
		assert.deepEqual(await asked(), [])
	})

	it('runs no more once it ran, until a migration asks again', async () => {
		await query('update `entry` set `routine_id` = null')
		await Backfill.runAsked(orm, [new RecognizeStoredEntries()])
		assert.deepEqual(await query('select `id` from `entry` where `routine_id` is not null'), [])
		await query(Backfill.asking('recognize-stored-entries'))
		await Backfill.runAsked(orm, [new RecognizeStoredEntries()])
		assert.ok((await query('select `id` from `entry` where `routine_id` is not null')).length)
	})

	it('leaves what a migration asked for and this version does not know', async () => {
		await query(Backfill.asking('unknown'))
		await Backfill.runAsked(orm, [new RecognizeStoredEntries()])
		assert.deepEqual(await asked(), ['backfill:unknown'])
	})
})
