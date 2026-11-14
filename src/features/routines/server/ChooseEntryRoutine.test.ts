import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { UpdateEntry } from '#features/entries/server/UpdateEntry.js'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { CreateSource } from '#features/sources/server/CreateSource.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ChooseEntryRoutine } from './ChooseEntryRoutine.js'
import { dailyRoutine } from './RoutineCorrections.testing.js'

describe('ChooseEntryRoutine', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const stored = async (id: string) => (await server.query<{ routine_id: string | null, routine_declined: number | null }>('select routine_id, routine_declined from entry where id = ?', [id]))[0]!

	it('takes an entry out of its routine for good with none, though its title still matches, and back in when one is chosen', async () => {
		const { id, routineId } = await dailyRoutine(server, 'Lunch with a colleague')
		// Another entry of the routine keeps it while this one is out: a routine its last entry leaves is removed.
		const start = new DateTime('2026-10-05T11:00:00.000Z')
		const { id: other } = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Lunch with a colleague', start, end: start.add({ hours: 1 }) })))
		assert.equal((await stored(other!)).routine_id, routineId)
		await ChooseEntryRoutine.call({ id, routineId: null })
		assert.deepEqual(await stored(id), { routine_id: null, routine_declined: 1 })
		await UpdateEntry.call({ ...EntryPatch.of(new Entry({ id, sourceId: server.source.id, type: EntryType.Event, heading: 'Lunch with a colleague ' }), ['heading']), id })
		assert.deepEqual(await stored(id), { routine_id: null, routine_declined: 1 })
		await ChooseEntryRoutine.call({ id, routineId })
		assert.deepEqual(await stored(id), { routine_id: routineId, routine_declined: null })
	})

	it('moves a recurring entry\'s overrides along with it', async () => {
		const yoga = await dailyRoutine(server, 'Yoga')
		const studio = await dailyRoutine(server, 'Yoga studio')
		const [row] = await server.query<{ uid: string }>('select uid from entry where id = ?', [studio.id])
		await server.query('insert into `entry` (`id`, `uid`, `source_id`, `type`, `heading`, `start`, `end`, `all_day`, `recurring_entry_id`, `recurrence_id`, `routine_id`) values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
			['studio-moved', row!.uid, server.source.id, 'event', 'Yoga studio', Date.parse('2026-09-03T07:00:00Z'), Date.parse('2026-09-03T07:30:00Z'), studio.id, Date.parse('2026-09-03T06:00:00Z'), studio.routineId])
		await ChooseEntryRoutine.call({ id: studio.id, routineId: yoga.routineId })
		assert.deepEqual([(await stored(studio.id)).routine_id, (await stored('studio-moved')).routine_id], [yoga.routineId, yoga.routineId])
	})

	it('refuses a routine of another calendar', async () => {
		const away = await CreateSource.call({ id: server.integration.id, name: 'Elsewhere' })
		const elsewhere = (await dailyRoutine(server, 'Swim', away.id)).routineId
		await assert.rejects(ChooseEntryRoutine.call({ id: (await dailyRoutine(server, 'Swim')).id, routineId: elsewhere }), (error: { status?: number }) => error.status === 400)
	})

	it('finds no routine of another user', async () => {
		const { id } = await dailyRoutine(server, 'Walk')
		await assert.rejects(ChooseEntryRoutine.call({ id, routineId: 'elsewhere' }), (error: { status?: number }) => error.status === 404)
	})
})
