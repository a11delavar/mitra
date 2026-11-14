import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { Recurrence, RecurrenceFrequency, RecurrenceWeekday } from '#features/recurrence'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { CreateSource } from '#features/sources/server/CreateSource.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { Routine } from '../Routine.js'
import { ListRoutines } from './ListRoutines.js'

describe('ListRoutines', () => {
	let server: OperationServer
	before(async () => {
		server = await OperationServer.start()
	})
	after(() => server.close())

	const start = new DateTime('2026-03-02T07:00:00.000Z')
	const create = async (heading: string, init: Partial<Entry> = {}) => (await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start, end: start.add({ minutes: 30 }), ...init })))).id!
	const routineOf = async (id: string) => (await server.query<{ routine_id: string }>('select routine_id from entry where id = ?', [id]))[0]!.routine_id
	const listed = async (entryId: string) => {
		const routineId = await routineOf(entryId)
		return (await ListRoutines.call()).find(routine => routine.id === routineId)
	}

	it('names the titles a routine\'s members wear, the newest first, as they spell them', async () => {
		const first = await create('Gym', { recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })
		await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: ' gym ', start: start.add({ days: 3 }), end: start.add({ days: 3, hours: 1 }) })))
		assert.deepEqual((await listed(first))!.titles, ['gym', 'Gym'])
	})

	it('tells the day of a routine\'s first date, a rule\'s start or its first entry of its own', async () => {
		const later = await create('Swim', { start: start.add({ days: 40 }), end: start.add({ days: 40, hours: 1 }), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })
		await create('Swim')
		assert.equal((await listed(later))!.since, '2026-03-02')
	})

	it('lists a routine with its calendar and how often it comes, read off its members: a daily rule every day', async () => {
		const stretch = (await listed(await create('Stretch', { recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })))!
		assert.ok(stretch instanceof Routine)
		assert.deepEqual([stretch.sourceId, stretch.cadence!.days], [server.source.id, 1])
	})

	it('adds up the rules of one habit kept as several recurring entries', async () => {
		let last = ''
		for (const weekday of ['TU', 'TH', 'SA']) {
			last = await create('Volleyball', { recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.parse(weekday)!] }) })
		}
		assert.equal((await listed(last))!.cadence!.days.toFixed(2), '2.33')
	})

	it('reads the gap between entries of their own where none repeats', async () => {
		let last = ''
		for (const index of [0, 1, 2, 3]) {
			last = await create('Haircut', { start: start.add({ days: index * 35 }), end: start.add({ days: index * 35, hours: 1 }) })
		}
		assert.equal((await listed(last))!.cadence!.days, 35)
	})

	it('lists neither a dissolved routine nor one of a calendar that is not enabled', async () => {
		const dissolved = await create('Lunch walk', { recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		const dissolvedRoutine = await routineOf(dissolved)
		await server.query('update routine set dissolved = 1 where id = ?', [dissolvedRoutine])
		const away = await CreateSource.call({ id: server.integration.id, name: 'Away' })
		const elsewhere = await create('Choir', { sourceId: away.id, recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })
		const elsewhereRoutine = await routineOf(elsewhere)
		assert.ok((await ListRoutines.call()).some(routine => routine.id === elsewhereRoutine))
		await server.query('update source set enabled = 0 where id = ?', [away.id])
		const ids = (await ListRoutines.call()).map(routine => routine.id)
		assert.equal(ids.includes(dissolvedRoutine), false)
		assert.equal(ids.includes(elsewhereRoutine), false)
	})
})
