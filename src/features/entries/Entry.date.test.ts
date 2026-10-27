import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import { TimeZone } from '#features/time/TimeZone.js'
import { holdLocalIn } from '#features/time/TimeZone.testing.js'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { revive, wireOf } from '#infrastructure/model/wire.testing.js'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'
import { EntryPatch } from './EntryPatch.js'

// `Entry.date`: an entry holds an all-day day as the midnight it begins where it is shown, and the wire carries it as its UTC midnight.
describe('Entry.date', () => {
	let restore: (() => void) | undefined
	const processZone = process.env.TZ
	afterEach(() => {
		restore?.()
		restore = undefined
		process.env.TZ = processZone
	})

	/** Shows days in `zone` as a browser there does, whose DateTimes are in that zone too. */
	const showIn = (zone: string | undefined) => {
		restore?.()
		restore = holdLocalIn(TimeZone.parse(zone))
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
			adopting.adopt(timed.span)
			const assigned = allDayCopy()
			assigned.assign(timed)
			for (const entry of [adopting, assigned]) {
				assert.deepEqual([entry.allDay, iso(entry.start), iso(entry.end)], [false, '2026-06-04T07:00:00.000Z', '2026-06-04T08:00:00.000Z'])
			}
		})

		it('when all-day turns off and on, the due becoming 17:00 of its day and then its day again', () => {
			showIn(zone)
			const entry = holiday({ start: midnight('2026-06-02', zone), end: midnight('2026-06-03', zone), due: midnight('2026-06-05', zone) })
			entry.setAllDay(false)
			assert.deepEqual([iso(entry.start), iso(entry.end), iso(entry.due)], ['2026-06-02T13:00:00.000Z', '2026-06-02T14:00:00.000Z', '2026-06-05T21:00:00.000Z'])
			entry.setAllDay(true)
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

	describe('a floating time, a wall clock in no zone', () => {
		const alarm = (init: Partial<Entry> = {}) => new Entry({ type: EntryType.Task, heading: 'Alarm', timeZone: EntryTimeZone.floating, ...init })
		const atWallClock = (wallClock: string, zone: string) => new DateTime(Temporal.PlainDateTime.from(wallClock).toZonedDateTime(zone).epochMilliseconds)

		it('arrives at its wall clock where it is shown, so every view places it there, and travels back as if in UTC', () => {
			for (const zone of ['Europe/Berlin', 'Asia/Tehran', 'America/New_York']) {
				showIn(zone)
				const arrived = revive<Entry>({ '@type': 'Entry', start: '2026-10-03T10:00:00.000Z', end: '2026-10-03T11:00:00.000Z', timeZone: 'floating' })
				assert.deepEqual([arrived.start!.hour, arrived.start!.minute, arrived.end!.hour], [10, 0, 11], zone)
				assert.deepEqual([wire(arrived).start, wire(arrived).end], ['2026-10-03T10:00:00.000Z', '2026-10-03T11:00:00.000Z'], zone)
			}
		})

		it('repeats at its wall clock where it is shown, across a change of daylight saving there', () => {
			showIn('Europe/Berlin')
			const arrived = revive<Entry>({ '@type': 'Entry', type: 'task', start: '2026-10-24T09:00:00.000Z', timeZone: 'floating', recurrence: 'FREQ=DAILY;COUNT=3' })
			const window = new DateTimeRange(new DateTime(Date.parse('2026-10-24T00:00:00Z')), new DateTime(Date.parse('2026-10-27T00:00:00Z')))
			assert.deepEqual([...arrived.occurrences.within(window)].map(occurrence => occurrence.start!.hour), [9, 9, 9])
		})

		it('keeps its clock times when it takes a zone where it is shown', () => {
			showIn('Europe/Berlin')
			const entry = alarm({ start: atWallClock('2026-10-03T10:00', 'Europe/Berlin') })
			entry.setTimeZone(EntryTimeZone.parse('Asia/Tokyo')!)
			assert.equal(iso(entry.start), '2026-10-03T01:00:00.000Z')
			assert.equal(wire(entry).start, '2026-10-03T01:00:00.000Z')
		})

		it('brings its zone along in an edit of its dates, which tells how they travel', () => {
			showIn('Asia/Tehran')
			const entry = alarm({ start: atWallClock('2026-10-03T07:00', 'Asia/Tehran') })
			const patch = wireOf(EntryPatch.of(entry, ['start'])) as { start?: string, timeZone?: string }
			assert.deepEqual([patch.start, patch.timeZone], ['2026-10-03T07:00:00.000Z', 'floating'])
			assert.equal('timeZone' in (wireOf(EntryPatch.of(new Entry({ start: entry.start }), ['start'])) as object), false, 'a zoned edit stays as it was')
		})

		it('is kept as stored on the server', () => {
			showIn(undefined)
			const arrived = revive<Entry>({ '@type': 'Entry', start: '2026-10-03T10:00:00.000Z', timeZone: 'floating' })
			assert.equal(iso(arrived.start), '2026-10-03T10:00:00.000Z')
		})
	})

	it('shows days in the device\'s zone in the browser, and in none on the server', () => {
		const runtime = mitra as { runtime: string }
		restore?.()
		restore = undefined
		assert.equal(TimeZone.local, undefined)
		runtime.runtime = 'browser'
		try {
			assert.equal(TimeZone.local, TimeZone.device)
		} finally {
			runtime.runtime = 'server'
		}
	})
})
