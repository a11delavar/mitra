import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { Recurrence, RecurrenceFrequency } from '#features/recurrence'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListRoutineEntries } from './ListRoutineEntries.js'

describe('ListRoutineEntries', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const create = async (heading: string, start: DateTime, init: Partial<Entry> = {}) =>
		(await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start, end: start.add({ minutes: 30 }), ...init })))).id!

	it('lists a routine\'s entries as stored, a repeating one whole, entries of their own from `since` on', async () => {
		const daily = await create('Stretch', new DateTime('2025-01-06T06:00:00.000Z'), { recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		const swims = []
		for (const day of [1, 8, 15, 22]) {
			swims.push(await create('Swim', new DateTime(`2026-09-${String(day).padStart(2, '0')}T17:00:00.000Z`)))
		}
		await create('Loose', new DateTime('2026-09-03T12:00:00.000Z'))
		const listed = await ListRoutineEntries.call({ since: new Date('2026-09-10T00:00:00.000Z') })
		assert.deepEqual(listed.map(entry => entry.id).toSorted(), [daily, ...swims.slice(2)].toSorted())
		assert.ok(listed.every(entry => entry instanceof Entry && entry.routineId))
		assert.ok(listed.find(entry => entry.id === daily)!.start instanceof Date)
	})
})
