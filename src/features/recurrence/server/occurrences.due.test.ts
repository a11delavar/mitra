import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Recurrence } from '../Recurrence.js'
import { EntryType } from '../../entries/EntryType.js'
import { Entry } from '../../entries/Entry.js'
import { Occurrences, occurrenceOf, currentOccurrence } from './occurrences.js'

type DateTime = import('@3mo/date-time').DateTime
const D = (iso: string) => new Date(iso) as unknown as DateTime

describe('a repeating task with a due', () => {
	const rent = () => new Entry({
		id: 'rent', sourceId: 's', type: EntryType.Task, heading: 'Pay the rent', allDay: true,
		due: D('2026-01-01T00:00:00Z'), estimate: 15, recurrence: new Recurrence({ freq: 'MONTHLY', bymonthday: 1 }),
	})

	it('repeats its due when it has no start', () => {
		const next = Occurrences.of(rent())!.next(new Date('2026-03-15T00:00:00Z'), 2)
		assert.deepEqual(next.map(occurrence => occurrence.start.toISOString()), ['2026-04-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'])
	})

	it('is current until the end of its due day where the viewer is', () => {
		// 1 Apr at 08:00 in Auckland is still 31 Mar in Honolulu.
		const now = new Date('2026-03-31T19:00:00Z')
		assert.equal(currentOccurrence(rent(), 'Pacific/Auckland', now)?.start.toISOString(), '2026-04-01T00:00:00.000Z')
		assert.equal(currentOccurrence(rent(), 'Pacific/Honolulu', now)?.start.toISOString(), '2026-04-01T00:00:00.000Z')
		assert.equal(currentOccurrence(rent(), 'Pacific/Auckland', new Date('2026-04-01T12:00:00Z'))?.start.toISOString(), '2026-05-01T00:00:00.000Z')
		assert.equal(currentOccurrence(rent(), 'Pacific/Honolulu', new Date('2026-04-01T12:00:00Z'))?.start.toISOString(), '2026-04-01T00:00:00.000Z')
	})

	it('yields unscheduled occurrences, each owed on its own day', () => {
		const occurrence = occurrenceOf(rent(), { start: new Date('2026-04-01T00:00:00Z') })
		assert.equal(occurrence.start, undefined)
		assert.equal(occurrence.end, undefined)
		assert.equal(occurrence.due?.valueOf(), Date.parse('2026-04-01T00:00:00Z'))
		assert.equal(occurrence.estimate, 15)
		assert.equal(occurrence.recurrenceId?.valueOf(), Date.parse('2026-04-01T00:00:00Z'))
	})

	it('keeps the due at its offset from a scheduled occurrence', () => {
		const timesheet = new Entry({
			id: 'sheet', sourceId: 's', type: EntryType.Task, heading: 'Timesheet',
			start: D('2026-06-05T13:00:00Z'), end: D('2026-06-05T13:30:00Z'), due: D('2026-06-05T15:00:00Z'),
			recurrence: new Recurrence({ freq: 'WEEKLY' }),
		})
		const [occurrence] = Occurrences.of(timesheet)!.within(new Date('2026-06-12T00:00:00Z'), new Date('2026-06-12T23:59:59Z'))
		const expanded = occurrenceOf(timesheet, occurrence!)
		assert.equal(expanded.end?.valueOf(), Date.parse('2026-06-12T13:30:00Z'))
		assert.equal(expanded.due?.valueOf(), Date.parse('2026-06-12T15:00:00Z'))
	})

	it('repeats a moment as moments', () => {
		const meds = new Entry({
			id: 'meds', sourceId: 's', type: EntryType.Task, heading: 'Morning Meds',
			start: D('2026-06-01T05:30:00Z'), recurrence: new Recurrence({ freq: 'DAILY' }),
		})
		const [occurrence] = Occurrences.of(meds)!.within(new Date('2026-06-03T00:00:00Z'), new Date('2026-06-03T23:59:59Z'))
		const expanded = occurrenceOf(meds, occurrence!)
		assert.equal(expanded.start?.valueOf(), Date.parse('2026-06-03T05:30:00Z'))
		assert.equal(expanded.end, undefined)
	})

	it('expands a stored VTODO by its schedule, not by the distance to its due', () => {
		const raw = [
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
			'BEGIN:VTODO', 'UID:sheet', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Timesheet',
			'DTSTART:20260605T130000Z', 'ESTIMATED-DURATION:PT30M', 'DUE:20260605T150000Z', 'RRULE:FREQ=WEEKLY',
			'END:VTODO', 'END:VCALENDAR',
		].join('\r\n')
		const master = new Entry({
			id: 'sheet', sourceId: 's', type: EntryType.Task, heading: 'Timesheet', data: { raw },
			start: D('2026-06-05T13:00:00Z'), end: D('2026-06-05T13:30:00Z'), due: D('2026-06-05T15:00:00Z'),
			recurrence: new Recurrence({ freq: 'WEEKLY' }),
		})
		const [occurrence] = Occurrences.of(master)!.within(new Date('2026-06-12T00:00:00Z'), new Date('2026-06-12T23:59:59Z'))
		assert.equal(occurrence!.end.toISOString(), '2026-06-12T13:30:00.000Z')
	})
})
