import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../../recurrence/RecurrenceFrequency.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { EntryTimeZone } from '../EntryTimeZone.js'
import { fetched, iso, midnight, shown, utcMidnight, viewIn, zones } from './viewers.testing.js'

describe('ListEntries', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('brings an all-day entry to every viewer on the same days, at their own midnights', async () => {
		viewIn(zones.berlin)
		const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Holiday', allDay: true, start: midnight('2026-06-02'), end: midnight('2026-06-05') }))
		for (const zone of Object.values(zones)) {
			viewIn(zone)
			const holiday = (await fetched('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
			assert.equal(holiday.start instanceof DateTime, true, zone)
			assert.deepEqual([iso(holiday.start), iso(holiday.end)], [iso(midnight('2026-06-02')), iso(midnight('2026-06-05'))], zone)
		}
	})

	it('brings a timed entry to every viewer at the same instant, in the zone it was written in', async () => {
		viewIn(zones.berlin)
		const start = new DateTime(Date.parse('2026-06-02T09:30:00+02:00'))
		const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Call', start, end: start.add({ minutes: 30 }) }))
		for (const zone of Object.values(zones)) {
			viewIn(zone)
			const call = (await fetched('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
			assert.deepEqual([iso(call.start), iso(call.end), call.timeZone], ['2026-06-02T07:30:00.000Z', '2026-06-02T08:00:00.000Z', EntryTimeZone.parse('Europe/Berlin')], zone)
		}
	})

	it('brings an all-day series, which every viewer expands to the same days', async () => {
		viewIn(zones.tehran)
		const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Market', allDay: true, start: midnight('2026-07-06'), end: midnight('2026-07-07'), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) }))
		for (const zone of Object.values(zones)) {
			viewIn(zone)
			const occurrences = (await shown('2026-07-01', '2026-07-25')).filter(occurrence => occurrence.recurringEntryId === id)
			assert.deepEqual(occurrences.map(occurrence => iso(occurrence.start)), ['2026-07-06', '2026-07-13', '2026-07-20'].map(day => iso(midnight(day))), zone)
			assert.deepEqual(occurrences.map(occurrence => iso(occurrence.recurrenceId)), ['2026-07-06', '2026-07-13', '2026-07-20'].map(day => iso(midnight(day))), zone)
			assert.deepEqual(occurrences.map(occurrence => occurrence.key), ['2026-07-06', '2026-07-13', '2026-07-20'].map(day => `${id}__${utcMidnight(day)}`), zone)
		}
	})

	it('refuses a window without its ends', async () => {
		const answer = await fetch(`${server.url}/entries`)
		assert.equal(answer.status, 400)
	})
})
