import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { CalDAV } from './CalDAV.js'
import './server/CalDAVSyncEngine.js'
import '../server/registerEngines.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { Source } from '../../features/sources/Source.js'

type DateTime = import('@3mo/date-time').DateTime
const D = (iso: string) => new Date(iso) as unknown as DateTime

const vtodo = (...lines: Array<string>) => [
	'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
	'BEGIN:VTODO', 'UID:t1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Report',
	...lines, 'END:VTODO', 'END:VCALENDAR',
].join('\r\n')

const componentOf = (raw: string) => new ICAL.Component(ICAL.parse(raw)).getFirstSubcomponent('vtodo')!
const read = (...lines: Array<string>) => CalDAV.taskTimesFrom(componentOf(vtodo(...lines)))
const ms = (value: Date | undefined) => value?.valueOf()

describe('a VTODO\'s dates', () => {
	describe('reading', () => {
		it('takes DTSTART and DUE without ESTIMATED-DURATION as the block mitra used to write, with no deadline', () => {
			const times = read('DTSTART:20260602T090000Z', 'DUE:20260602T100000Z')
			assert.equal(ms(times.start), Date.parse('2026-06-02T09:00:00Z'))
			assert.equal(ms(times.end), Date.parse('2026-06-02T10:00:00Z'))
			assert.equal(times.due, undefined)
		})

		it('takes ESTIMATED-DURATION as the block, so DUE is the deadline', () => {
			const times = read('DTSTART:20260602T090000Z', 'ESTIMATED-DURATION:PT2H', 'DUE:20260605T170000Z')
			assert.equal(ms(times.end), Date.parse('2026-06-02T11:00:00Z'))
			assert.equal(ms(times.due), Date.parse('2026-06-05T17:00:00Z'))
			assert.equal(times.estimate, null)
		})

		it('takes a DTSTART alone as a moment', () => {
			const times = read('DTSTART:20260602T100000Z')
			assert.equal(ms(times.start), Date.parse('2026-06-02T10:00:00Z'))
			assert.equal(times.end, undefined)
			assert.equal(times.due, undefined)
		})

		it('takes a DUE without DTSTART as an unscheduled task, its ESTIMATED-DURATION as the estimate', () => {
			const times = read('DUE:20260605T170000Z', 'ESTIMATED-DURATION:PT1H30M')
			assert.equal(times.start, undefined)
			assert.equal(times.end, undefined)
			assert.equal(ms(times.due), Date.parse('2026-06-05T17:00:00Z'))
			assert.equal(times.estimate, 90)
		})

		it('adds a day of ESTIMATED-DURATION as a calendar day, keeping the wall clock across a DST change', () => {
			// Berlin leaves summer time on 25 Oct 2026: 22:00 to 22:00 the next day is 25 hours.
			const times = read('DTSTART;TZID=Europe/Berlin:20261024T220000', 'ESTIMATED-DURATION:P1D')
			assert.equal(ms(times.end), Date.parse('2026-10-25T21:00:00Z'))
		})

		it('reads a dated DUE as an all-day due on that day', () => {
			const times = read('DUE;VALUE=DATE:20260605')
			assert.equal(times.allDay, true)
			assert.equal(ms(times.due), Date.parse('2026-06-05T00:00:00Z'))
		})

		it('keeps an undated task undated, with whatever estimate it has', () => {
			const times = read('ESTIMATED-DURATION:P2D')
			assert.equal(times.start, undefined)
			assert.equal(times.due, undefined)
			assert.equal(times.estimate, 2 * 24 * 60)
		})
	})

	describe('writing', () => {
		const written = (fields: Partial<Entry>) => {
			const comp = new ICAL.Component(ICAL.parse(vtodo()))
			const component = comp.getFirstSubcomponent('vtodo')!
			CalDAV.writeTaskTimes(comp, component, { allDay: false, timeZone: null, estimate: null, ...fields } as Entry)
			return comp.toString()
		}

		it('writes a block as DTSTART and its length, and DUE only for a deadline', () => {
			const raw = written({ start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T11:00:00Z') })
			assert.match(raw, /DTSTART:20260602T090000Z/)
			assert.match(raw, /ESTIMATED-DURATION:PT2H/)
			assert.doesNotMatch(raw, /DUE/)
		})

		it('writes a timed length in hours, which no reader takes for calendar days', () => {
			const raw = written({ start: D('2026-10-24T20:00:00Z'), end: D('2026-10-25T22:00:00Z') })
			assert.match(raw, /ESTIMATED-DURATION:PT26H/)
		})

		it('writes a whole-day estimate in days, and any other in hours', () => {
			assert.match(written({ estimate: 2 * 24 * 60 }), /ESTIMATED-DURATION:P2D/)
			assert.match(written({ estimate: 26 * 60 }), /ESTIMATED-DURATION:PT26H/)
		})

		it('writes the deadline next to the block', () => {
			const raw = written({ start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T11:00:00Z'), due: D('2026-06-05T17:00:00Z') })
			assert.match(raw, /DUE:20260605T170000Z/)
		})

		it('writes an unscheduled task as its due and its estimate', () => {
			const raw = written({ due: D('2026-06-05T17:00:00Z'), estimate: 90 })
			assert.doesNotMatch(raw, /DTSTART/)
			assert.match(raw, /DUE:20260605T170000Z/)
			assert.match(raw, /ESTIMATED-DURATION:PT1H30M/)
		})

		it('writes an all-day block in days and an all-day due as a date', () => {
			const raw = written({ allDay: true, start: D('2026-06-02T00:00:00Z'), end: D('2026-06-04T00:00:00Z'), due: D('2026-06-05T00:00:00Z') })
			assert.match(raw, /DTSTART;VALUE=DATE:20260602/)
			assert.match(raw, /ESTIMATED-DURATION:P2D/)
			assert.match(raw, /DUE;VALUE=DATE:20260605/)
		})

		it('round-trips what it writes', () => {
			const fields = { start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T11:00:00Z'), due: D('2026-06-05T17:00:00Z') }
			const times = CalDAV.taskTimesFrom(componentOf(written(fields)))
			assert.equal(ms(times.end), ms(fields.end))
			assert.equal(ms(times.due), ms(fields.due))
		})
	})

	it('drops the deadline a legacy block never had on its next edit', async () => {
		const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			updateCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
		})
		const em = { find: () => Promise.resolve([]), findOne: () => Promise.resolve(new Source({ id: 's', integrationId: 'i', uri: 'https://example.com/cal/', entryTypes: [EntryType.Task], name: 'Cal' })) } as never
		const raw = vtodo('DTSTART:20260602T090000Z', 'DUE:20260602T100000Z')
		const existing = new Entry({
			id: 't1', sourceId: 's', type: EntryType.Task, heading: 'Report', uri: 'https://example.com/cal/t1.ics',
			start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), data: { raw },
		})
		const incoming = new Entry({ ...existing, start: D('2026-06-02T13:00:00Z'), end: D('2026-06-02T14:00:00Z') } as Partial<Entry>)

		await dav.updateEntry(em, existing, incoming)

		assert.match(existing.data!.raw!, /DTSTART:20260602T130000Z/)
		assert.match(existing.data!.raw!, /ESTIMATED-DURATION:PT1H/)
		assert.doesNotMatch(existing.data!.raw!, /DUE/)
	})
})
