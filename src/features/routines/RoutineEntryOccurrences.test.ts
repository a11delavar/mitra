import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryStatus } from '#features/entries'
import { Recurrence, RecurrenceFrequency, type EntryOccurrence } from '#features/recurrence'
import { TimeZone } from '#features/time/TimeZone.js'
import { RoutineEntries } from './RoutineEntries.js'
import type { RoutineEntryOccurrences } from './RoutineEntryOccurrences.js'
import { RoutineEntryOccurrenceStatus } from './RoutineEntryOccurrenceStatus.js'

describe('RoutineEntryOccurrences, read off RoutineEntries', () => {
	const berlin = TimeZone.of('Europe/Berlin')
	/** Monday 2026-10-19, 12:00 in Berlin. */
	const now = new Date('2026-10-19T10:00:00Z')
	const at = (iso: string) => new DateTime(iso)
	const event = (iso: string, init: Partial<Entry> = {}) => new Entry({ id: `e-${iso}`, sourceId: 's', routineId: 'r', type: EntryType.Event, heading: 'Gym', start: at(iso), end: at(iso).add({ hours: 1 }), ...init })
	const task = (iso: string, init: Partial<Entry> = {}) => event(iso, { type: EntryType.Task, status: EntryStatus.ToDo, ...init })
	/** A routine of `members` as read at `now`. */
	const of = (...members: Array<Entry>) => RoutineEntries.of(members).occurrencesAt(now, berlin)
	const read = (dates: RoutineEntryOccurrences, occurrences: ReadonlyArray<EntryOccurrence>) => occurrences.map(occurrence => `${occurrence.dayIn(berlin)} ${dates.statusOf(occurrence)}`)

	it('reads its dates to today and the first one still to come, whatever entries they are', () => {
		const dates = of(
			event('2026-10-12T16:00:00Z'),
			event('2026-10-13T16:00:00Z', { status: EntryStatus.Cancelled }),
			event('2026-10-25T16:00:00Z'),
			event('2026-11-01T16:00:00Z'),
		)
		assert.deepEqual(read(dates, dates.last(14)), ['2026-10-12 kept', '2026-10-13 cancelled'])
		assert.deepEqual(read(dates, [dates.next!]), ['2026-10-25 upcoming'])
	})

	it('counts a date the rule excludes as nothing at all, never as missed', () => {
		const dates = of(task('2026-10-12T06:00:00Z', { recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }), exdates: [Date.parse('2026-10-14T06:00:00Z')] }))
		const past = dates.last(Infinity).filter(occurrence => dates.statusOf(occurrence)?.settled)
		assert.deepEqual(past.map(occurrence => String(occurrence.dayIn(berlin))), ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
		assert.ok(past.every(occurrence => dates.statusOf(occurrence) === RoutineEntryOccurrenceStatus.Missed))
	})

	it('reads an override another app renamed and ticked off as the date of its recurring entry, whatever routine it names', () => {
		const daily = task('2026-10-16T06:00:00Z', { id: 'meds', recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		daily.overrides = [task('2026-10-17T07:00:00Z', { id: 'moved', heading: 'Meds, late', routineId: undefined, status: EntryStatus.Done, recurringEntryId: 'meds', recurrenceId: at('2026-10-17T06:00:00Z') })]
		const dates = of(daily, ...daily.overrides)
		assert.deepEqual(read(dates, dates.last(14)), ['2026-10-16 missed', '2026-10-17 kept', '2026-10-18 missed', '2026-10-19 open'])
	})

	it('counts kept of the last settled dates, a cancelled one against them', () => {
		const dates = of(
			task('2026-10-15T06:00:00Z', { status: EntryStatus.Done }),
			task('2026-10-16T06:00:00Z', { status: EntryStatus.Cancelled }),
			task('2026-10-17T06:00:00Z', { status: EntryStatus.Done }),
			task('2026-10-18T06:00:00Z'),
			task('2026-10-19T06:00:00Z'),
		)
		assert.deepEqual([dates.kept(14), dates.settled(14)], [2, 4])
		assert.deepEqual([dates.kept(2), dates.settled(2)], [1, 2])
		assert.deepEqual(read(dates, dates.last(3)), ['2026-10-17 kept', '2026-10-18 missed', '2026-10-19 open'])
	})

	it('tells the weekday it slips on only from three missed or cancelled dates', () => {
		const sundays = ['2026-09-27', '2026-10-04', '2026-10-11'].map(day => task(`${day}T06:00:00Z`))
		const mondays = ['2026-09-28', '2026-10-05', '2026-10-12'].map(day => task(`${day}T06:00:00Z`, { status: EntryStatus.Done }))
		const yearAgo = Temporal.PlainDate.from('2025-10-19')
		assert.deepEqual(of(...sundays, ...mondays).slipsAfter(yearAgo), { weekday: 7, count: 3, of: 3 })
		assert.equal(of(...sundays.slice(1), ...mondays).slipsAfter(yearAgo), undefined)
	})

	it('names among a routine\'s entries the recurring one with the tightest rule', () => {
		const daily = event('2026-10-13T16:00:00Z', { id: 'daily', recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		assert.equal(RoutineEntries.of([event('2026-10-12T16:00:00Z', { id: 'weekly', recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) }), daily]).tightest, daily)
	})

	it('has nothing to tell of entries without a date', () => {
		const dates = of(task('2026-10-17T06:00:00Z', { start: undefined }))
		assert.deepEqual([dates.last(14), dates.next, dates.kept(14)], [[], undefined, 0])
	})
})
