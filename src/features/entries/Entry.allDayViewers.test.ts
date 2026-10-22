import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TimeZone } from '#features/time/TimeZone.js'
import { holdLocalIn } from '#features/time/TimeZone.testing.js'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { revive, wireOf } from '#infrastructure/model/wire.testing.js'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'

/*
	What viewers in different zones see of one all-day entry, pinned before the translation between a viewer's midnights
	and the stored days moves. The harness below is the only part such a move may rewrite: what a viewer in `zone` keeps
	when it saves, what it sees of what is kept, and which occurrence it names.
*/

type Dates = Partial<Record<'start' | 'end' | 'due' | 'recurrenceId' | 'seriesStart', Date>>
type DateField = keyof Dates

/** Runs `action` where days are read in `zone`, as a browser there does; none is the server, which keeps them as stored. */
const readingDaysIn = <T>(zone: string | undefined, action: () => T): T => {
	const restore = holdLocalIn(TimeZone.parse(zone))
	try {
		return action()
	} finally {
		restore()
	}
}

const viewer = (zone: string) => ({
	/** What is kept when this viewer saves an entry built from the dates it sees; `sent` names the dates the request carries. */
	save: (init: Partial<Entry>, sent?: Array<DateField>) => {
		const kept = revive<Entry>(readingDaysIn(zone, () => wireOf(new Entry(init))))
		for (const field of sent ? (['start', 'end', 'due'] as const).filter(field => !sent.includes(field)) : []) {
			kept[field] = init[field]
		}
		return kept
	},
	/** How this viewer sees what is kept. */
	see: (kept: Entry): Partial<Entry> => {
		const sent = wireOf(kept)
		return readingDaysIn(zone, () => revive<Entry>(sent))
	},
	/** The occurrence this viewer names by the date it sees it on. */
	occurrenceOf: (kept: Entry, seen: Date) => new Date(readingDaysIn(zone, () => wireOf(new Entry({ allDay: kept.allDay, recurrenceId: seen as never }))).recurrenceId),
})

/** The midnight that begins `day` in `zone`. */
const midnight = (day: string, zone: string) => TimeZone.of(zone).midnightOf(Temporal.PlainDate.from(day))
const iso = (value: unknown) => value === undefined || value === null ? value : new Date((value as Date).valueOf()).toISOString()
const datesOf = (entry: Partial<Entry>) => Object.fromEntries((['start', 'end', 'due', 'recurrenceId'] as const)
	.filter(field => entry[field]).map(field => [field, iso(entry[field])]))
const shown = (dates: Record<string, string>, zone: string) => Object.fromEntries(Object.entries(dates).map(([field, day]) => [field, iso(midnight(day, zone))]))
const holiday = (zone: string, dates: Record<string, string>, init: Partial<Entry> = {}): Partial<Entry> =>
	({ type: EntryType.Task, heading: 'Holiday', allDay: true, ...Object.fromEntries(Object.entries(dates).map(([field, day]) => [field, midnight(day, zone)])) as Dates, ...init }) as Partial<Entry>

const zones = ['Europe/Berlin', 'America/New_York', 'Asia/Tehran', 'Pacific/Auckland', 'America/Santiago', 'UTC']

describe('An all-day entry across viewers', () => {
	it('keeps each day as its UTC midnight, whoever saves it', () => {
		for (const zone of zones) {
			const kept = viewer(zone).save(holiday(zone, { start: '2026-06-02', end: '2026-06-05', due: '2026-06-04' }))
			assert.deepEqual(datesOf(kept), shown({ start: '2026-06-02', end: '2026-06-05', due: '2026-06-04' }, 'UTC'), zone)
		}
	})

	it('shows every viewer the same days, each at its own midnight', () => {
		const kept = viewer('Europe/Berlin').save(holiday('Europe/Berlin', { start: '2026-06-02', end: '2026-06-05' }))
		for (const zone of zones) {
			assert.deepEqual(datesOf(viewer(zone).see(kept)), shown({ start: '2026-06-02', end: '2026-06-05' }, zone), zone)
		}
	})

	it('saves what a viewer sees back unchanged', () => {
		const kept = viewer('Asia/Tehran').save(holiday('Asia/Tehran', { start: '2026-06-02', end: '2026-06-03' }))
		for (const zone of zones) {
			const again = viewer(zone).save(viewer(zone).see(kept))
			assert.deepEqual(datesOf(again), datesOf(kept), zone)
		}
	})

	it('begins a day whose midnight a change of clocks skips at its first hour', () => {
		// Santiago's clocks spring from 00:00 to 01:00 on Sun 6 Sep 2026.
		const kept = viewer('UTC').save(holiday('UTC', { start: '2026-09-06', end: '2026-09-07' }))
		const seen = viewer('America/Santiago').see(kept)
		assert.equal(iso(seen.start), '2026-09-06T04:00:00.000Z')
		assert.deepEqual(datesOf(viewer('America/Santiago').save(seen)), datesOf(kept))
	})

	it('leaves the dates a request does not carry as they are kept, west of UTC too', () => {
		const kept = viewer('UTC').save(holiday('UTC', { start: '2026-06-02', end: '2026-06-05' }))
		const moved = viewer('America/New_York').see(kept)
		moved.start = midnight('2026-06-03', 'America/New_York') as never
		const again = viewer('America/New_York').save({ ...moved, end: kept.end }, ['start'])
		assert.deepEqual(datesOf(again), shown({ start: '2026-06-03', end: '2026-06-05' }, 'UTC'))
	})

	it('names an occurrence by the day it falls on, wherever it is seen from', () => {
		const series = viewer('UTC').save(holiday('UTC', { start: '2026-06-01', end: '2026-06-02' }, { type: EntryType.Event }))
		for (const zone of zones) {
			assert.equal(iso(viewer(zone).occurrenceOf(series, midnight('2026-06-08', zone))), '2026-06-08T00:00:00.000Z', zone)
		}
	})

	it('shows the date an override takes over at the viewer\'s midnight too', () => {
		const override = new Entry({ type: EntryType.Event, heading: 'Holiday', allDay: true, recurringEntryId: 'holiday', recurrenceId: midnight('2026-06-08', 'UTC') as never })
		for (const zone of zones) {
			assert.deepEqual(datesOf(viewer(zone).see(override)), shown({ recurrenceId: '2026-06-08' }, zone), zone)
		}
	})

	it('touches no timed entry, wherever it is saved or seen', () => {
		const at = new Date('2026-06-02T07:30:00Z')
		for (const zone of zones) {
			const meeting = { type: EntryType.Event, heading: 'Call', start: at as never, end: new Date('2026-06-02T08:00:00Z') as never, timeZone: EntryTimeZone.parse('Europe/Berlin') }
			const kept = viewer(zone).save(meeting)
			assert.deepEqual(datesOf(kept), { start: '2026-06-02T07:30:00.000Z', end: '2026-06-02T08:00:00.000Z' }, zone)
			assert.deepEqual(datesOf(viewer(zone).see(kept)), datesOf(kept), zone)
			assert.equal(iso(viewer(zone).occurrenceOf(kept, at)), iso(at), zone)
		}
	})
})
