import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'
import { TimeZone } from '../time/TimeZone.js'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'

// `Entry.date`: an entry holds an all-day day as the midnight it begins where it is shown, and the wire carries it as its UTC midnight.
describe('Entry.date', () => {
	const serverDays = Entry.dayZone
	const processZone = process.env.TZ
	afterEach(() => {
		Entry.dayZone = serverDays
		process.env.TZ = processZone
	})

	/** Shows days in `zone` as a browser there does, whose DateTimes are in that zone too. */
	const showIn = (zone: string | undefined) => {
		Entry.dayZone = () => TimeZone.parse(zone)
		process.env.TZ = zone ?? processZone
	}
	const midnight = (day: string, zone: string) => new DateTime(TimeZone.of(zone).midnightOf(Temporal.PlainDate.from(day)).getTime())
	const iso = (value: { valueOf(): number } | string | null | undefined) => value === null || value === undefined ? value : new Date(typeof value === 'string' ? value : value.valueOf()).toISOString()
	const wire = (entry: Entry) => wireOf(entry) as { start?: string, end?: string, due?: string, recurrenceId?: string, exdates?: Array<number>, allDay?: boolean }
	const holiday = (init: Partial<Entry> = {}) => new Entry({ type: EntryType.Task, heading: 'Holiday', allDay: true, ...init })

	it('holds the dates as given, a plain field to read', () => {
		showIn('America/New_York')
		const day = midnight('2026-06-02', 'America/New_York')
		const entry = holiday({ start: day })
		assert.equal(entry.start, day)
		assert.equal(Object.getOwnPropertyDescriptor(entry, 'start')?.value, day)
	})

	it('sends an all-day day as its UTC midnight, and arrives as the midnight it begins where it is shown', () => {
		showIn('America/New_York')
		const entry = holiday({ start: midnight('2026-06-02', 'America/New_York'), end: midnight('2026-06-05', 'America/New_York') })
		assert.deepEqual([wire(entry).start, wire(entry).end], ['2026-06-02T00:00:00.000Z', '2026-06-05T00:00:00.000Z'])
		const sent = wire(entry)
		for (const [zone, shown] of [['Asia/Tehran', '2026-06-01T20:30:00.000Z'], ['Pacific/Auckland', '2026-06-01T12:00:00.000Z'], ['America/New_York', '2026-06-02T04:00:00.000Z']] as const) {
			showIn(zone)
			const arrived = revive<Entry>(sent)
			assert.equal(arrived.start instanceof DateTime, true, zone)
			assert.equal(iso(arrived.start), shown, zone)
		}
	})

	it('sends a timed entry\'s instants, and absent dates absent', () => {
		showIn('Asia/Tehran')
		const at = new DateTime(Date.parse('2026-06-02T09:30:00Z'))
		const timed = new Entry({ type: EntryType.Event, heading: 'Call', start: at })
		assert.equal(wire(timed).start, '2026-06-02T09:30:00.000Z')
		assert.equal('end' in wire(timed), false)
		assert.equal(wire(holiday({ start: null as never })).start, null)
	})

	it('passes everything through on the server, which keeps days as stored', () => {
		showIn(undefined)
		const entry = holiday({ start: new Date('2026-06-02T00:00:00Z') as never })
		assert.equal(wire(entry).start, '2026-06-02T00:00:00.000Z')
		assert.equal(revive<Entry>(wire(entry)).start, '2026-06-02T00:00:00.000Z' as never)
	})

	it('reads the flag from the entry it converts, whatever order the fields come in', () => {
		showIn('America/New_York')
		const day = midnight('2026-06-02', 'America/New_York')
		for (const entry of [new Entry({ allDay: true, start: day }), new Entry({ start: day, allDay: true })]) {
			assert.equal(wire(entry).start, '2026-06-02T00:00:00.000Z')
		}
		const { start, allDay } = wire(new Entry({ allDay: true, start: day }))
		for (const payload of [{ '@type': 'Entry', allDay, start }, { '@type': 'Entry', start, allDay }]) {
			assert.equal(iso(revive<Entry>(payload).start), iso(day))
		}
	})

	describe('a change of kind keeps the times it is given, in any order', () => {
		const zone = 'America/New_York'
		const at = (value: string) => new DateTime(Date.parse(value))
		const allDayCopy = () => holiday({ start: midnight('2026-06-02', zone), end: midnight('2026-06-04', zone) })

		it('in a literal turning a copy timed', () => {
			showIn(zone)
			for (const entry of [
				new Entry({ ...allDayCopy(), start: at('2026-06-04T07:00:00Z'), end: at('2026-06-04T08:00:00Z'), allDay: false }),
				new Entry({ ...allDayCopy(), allDay: false, start: at('2026-06-04T07:00:00Z'), end: at('2026-06-04T08:00:00Z') }),
			]) {
				assert.deepEqual([entry.allDay, iso(entry.start), iso(entry.end), wire(entry).start], [false, '2026-06-04T07:00:00.000Z', '2026-06-04T08:00:00.000Z', '2026-06-04T07:00:00.000Z'])
			}
		})

		it('when an all-day entry adopts or takes over a timed span', () => {
			showIn(zone)
			const timed = new Entry({ type: EntryType.Task, heading: 'Holiday', start: at('2026-06-04T07:00:00Z'), end: at('2026-06-04T08:00:00Z') })
			const adopting = allDayCopy()
			adopting.adoptSpan(timed)
			const assigned = allDayCopy()
			assigned.assign(timed)
			for (const entry of [adopting, assigned]) {
				assert.deepEqual([entry.allDay, iso(entry.start), iso(entry.end)], [false, '2026-06-04T07:00:00.000Z', '2026-06-04T08:00:00.000Z'])
			}
		})

		it('when all-day turns off and on, the due becoming 17:00 of its day and then its day again', () => {
			showIn(zone)
			const entry = holiday({ start: midnight('2026-06-02', zone), end: midnight('2026-06-03', zone), due: midnight('2026-06-05', zone) })
			entry.setAllDay(false, 60)
			assert.deepEqual([iso(entry.start), iso(entry.end), iso(entry.due)], ['2026-06-02T13:00:00.000Z', '2026-06-02T14:00:00.000Z', '2026-06-05T21:00:00.000Z'])
			entry.setAllDay(true, 60)
			assert.deepEqual([wire(entry).start, wire(entry).end, wire(entry).due], ['2026-06-02T00:00:00.000Z', '2026-06-03T00:00:00.000Z', '2026-06-05T00:00:00.000Z'])
		})
	})

	it('carries every date of an occurrence under its own name, and nothing else', () => {
		showIn('Asia/Tehran')
		const entry = holiday({ start: midnight('2026-06-02', 'Asia/Tehran'), recurrenceId: midnight('2026-06-02', 'Asia/Tehran'), exdates: [midnight('2026-06-09', 'Asia/Tehran').getTime()] })
		const sent = wire(entry)
		assert.deepEqual(Object.keys(sent).filter(key => key.startsWith('_')), [])
		assert.deepEqual([sent.start, sent.recurrenceId, sent.exdates, sent.allDay], ['2026-06-02T00:00:00.000Z', '2026-06-02T00:00:00.000Z', [Date.parse('2026-06-09T00:00:00.000Z')], true])
		const arrived = revive<Entry>(sent)
		assert.deepEqual([iso(arrived.start), iso(arrived.recurrenceId), arrived.exdates], [iso(entry.start), iso(entry.recurrenceId), entry.exdates])
	})

	it('shows days in the device\'s zone in the browser, and in none on the server', () => {
		const runtime = mitra as { runtime: string }
		Entry.dayZone = serverDays
		assert.equal(Entry.dayZone(), undefined)
		runtime.runtime = 'browser'
		try {
			assert.equal(Entry.dayZone(), TimeZone.device)
		} finally {
			runtime.runtime = 'server'
		}
	})
})
