import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ChooseEntryRoutine } from './ChooseEntryRoutine.js'
import { CreateRoutine } from './CreateRoutine.js'
import { DissolveRoutine } from './DissolveRoutine.js'
import { dailyRoutine, routine, routineOf } from './RoutineCorrections.testing.js'

describe('CreateRoutine', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const once = (heading: string, day: number) => {
		const start = new DateTime('2026-09-01T16:00:00.000Z').add({ days: day })
		return CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start, end: start.add({ hours: 1 }) })))
	}

	it('starts a routine from one entry, which later entries of its title join by themselves', async () => {
		const first = await once('Piano lesson', 0)
		assert.equal(await routineOf(server, first.id!), undefined)
		const started = await CreateRoutine.call({ entryId: first.id! })
		assert.equal(await routineOf(server, first.id!), started.id)
		assert.equal(await routineOf(server, (await once('Piano lesson', 42)).id!), started.id)
	})

	it('starts a dissolved routine again rather than a second one beside it', async () => {
		const { id, routineId } = await dailyRoutine(server, 'Journal')
		await DissolveRoutine.call({ id: routineId })
		assert.equal((await CreateRoutine.call({ entryId: id })).id, routineId)
		assert.equal((await routine(server, routineId))!.dissolved, null)
	})

	it('takes an entry out of every routine back in, starting again the dissolved one its title gathered in', async () => {
		const { id, routineId } = await dailyRoutine(server, 'Stretching')
		const loose = await once('Stretching', 3)
		await ChooseEntryRoutine.call({ id: loose.id!, routineId: null })
		await DissolveRoutine.call({ id: routineId })
		assert.equal((await CreateRoutine.call({ entryId: loose.id! })).id, routineId)
		assert.deepEqual([await routineOf(server, loose.id!), await routineOf(server, id)], [routineId, routineId])
	})
})
