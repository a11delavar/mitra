import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createEvent, deleteOccurrence, settleTimeZone } from '../../../infrastructure/http/Api.js'
import { OperationServer, type SentEntry as Row } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../../recurrence/RecurrenceFrequency.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { iso, midnight, shown, utcMidnight, viewIn, zones } from './viewers.testing.js'
import { EntryOccurrenceChangeScope } from '../../recurrence/EntryOccurrenceChange.js'

describe('DeleteEntryOccurrence', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const exdates = async (id: string) => JSON.parse((await server.query<{ exdates: string | null }>('select exdates from entry where id = ?', [id]))[0]?.exdates ?? '[]') as Array<number>

	it('deletes the occurrence of an all-day series its viewer points at, by the day it falls on', async () => {
		viewIn(zones.tehran)
		const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Market', allDay: true, start: midnight('2026-07-06'), end: midnight('2026-07-07'), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) }))

		viewIn(zones.newYork)
		const [, , third] = (await shown('2026-07-01', '2026-07-25')).filter(occurrence => occurrence.recurringEntryId === id)
		await deleteOccurrence(third!, EntryOccurrenceChangeScope.This)
		assert.deepEqual(await exdates(id!), [utcMidnight('2026-07-20')])

		viewIn(zones.auckland)
		const seen = (await shown('2026-07-01', '2026-07-25')).filter(occurrence => occurrence.recurringEntryId === id)
		assert.deepEqual(seen.map(occurrence => iso(occurrence.start)), [iso(midnight('2026-07-06')), iso(midnight('2026-07-13'))])
	})

	describe('as a tool', () => {
		before(() => settleTimeZone('Europe/Berlin'))

		it('deletes an occurrence and every later one, the earlier ones kept', async () => {
			const series = await server.tool<Row>('create_entry', { heading: 'Water plants', type: 'task', start: '2027-03-01T08:00[Europe/Berlin]', estimate: 15, recurrence: 'FREQ=WEEKLY;BYDAY=MO' })
			await server.tool('delete_entry_occurrence', { id: series.id, occurrence: '2027-03-15T07:00:00Z', scope: 'following' })
			const { entries } = await server.tool<{ entries: Array<Row> }>('get_overview', { start: '2027-03-01', end: '2027-03-28' })
			assert.deepEqual(entries.filter(row => row.id === series.id).map(row => row.start), ['2027-03-01T07:00:00.000Z', '2027-03-08T07:00:00.000Z'])
		})

		it('refuses a date the entry never takes place on', async () => {
			const series = await server.tool<Row>('create_entry', { heading: 'Gym', start: '2027-03-02T07:00[Europe/Berlin]', end: '2027-03-02T08:00[Europe/Berlin]', recurrence: 'FREQ=WEEKLY' })
			const answer = await server.callTool('delete_entry_occurrence', { id: series.id, occurrence: '2027-03-03T06:00:00Z', scope: 'this' })
			assert.match(answer.content[0]!.text, /takes no place/)
		})

		it('names every argument it cannot read, before anything runs', async () => {
			const answer = await server.callTool('delete_entry_occurrence', { id: 'any', occurrence: 'next monday', scope: 'some' })
			assert.equal(answer.isError, true)
			assert.match(answer.content[0]!.text, /scope: Invalid option/)
		})
	})

	it('answers a request it cannot read with the fields it names', async () => {
		const response = await fetch(`${server.url}/entries/any/occurrences/next%20monday?scope=this`, { method: 'DELETE' })
		assert.equal(response.status, 400)
		assert.match(await response.text(), /occurrence/)
	})
})
