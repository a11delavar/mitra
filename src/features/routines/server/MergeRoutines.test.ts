import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { CreateSource } from '#features/sources/server/CreateSource.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { MergeRoutines } from './MergeRoutines.js'
import { dailyRoutine, routine, routineOf } from './RoutineCorrections.testing.js'

describe('MergeRoutines', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('moves every entry into the other routine and removes the first; a later entry of either title joins the one left', async () => {
		const morning = await dailyRoutine(server, 'Morning pills')
		const evening = await dailyRoutine(server, 'Evening pills')
		await MergeRoutines.call({ id: evening.routineId, into: morning.routineId })
		assert.equal(await routineOf(server, evening.id), morning.routineId)
		assert.equal(await routine(server, evening.routineId), undefined)
		const start = new DateTime('2026-09-10T18:00:00.000Z')
		const { id } = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Evening pills', start, end: start.add({ minutes: 5 }) })))
		assert.equal(await routineOf(server, id!), morning.routineId)
	})

	it('refuses a routine of another calendar, and the routine itself', async () => {
		const away = await CreateSource.call({ id: server.integration.id, name: 'Away' })
		const home = await dailyRoutine(server, 'Stretch')
		const elsewhere = await dailyRoutine(server, 'Stretch', away.id)
		await assert.rejects(MergeRoutines.call({ id: home.routineId, into: elsewhere.routineId }), (error: { status?: number }) => error.status === 400)
		await assert.rejects(MergeRoutines.call({ id: home.routineId, into: home.routineId }), (error: { status?: number }) => error.status === 400)
	})

	it('finds no routine of another user', async () => {
		const home = await dailyRoutine(server, 'Walk')
		await server.query('insert into `user` (`id`, `username`) values (?, ?)', ['other', 'other'])
		await server.query('insert into `integration` (`id`, `user_id`, `uri`, `type`, `credentials`) values (?, ?, ?, ?, ?)', ['other-mitra', 'other', 'mitra://local', 'mitra', '{}'])
		await server.query('insert into `source` (`id`, `integration_id`, `uri`, `entry_types`, `name`, `enabled`, `hidden`) values (?, ?, ?, ?, ?, 1, 0)', ['other-home', 'other-mitra', 'mitra://local/home', '["event"]', 'Home'])
		await server.query('insert into `routine` (`id`, `source_id`) values (?, ?)', ['other-walk', 'other-home'])
		await assert.rejects(MergeRoutines.call({ id: home.routineId, into: 'other-walk' }), (error: { status?: number }) => error.status === 404)
	})
})
