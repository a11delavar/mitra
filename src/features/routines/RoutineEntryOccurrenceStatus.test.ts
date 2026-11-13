import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryStatus } from '#features/entries'
import { TimeZone } from '#features/time/TimeZone.js'
import { RoutineEntryOccurrenceStatus } from './RoutineEntryOccurrenceStatus.js'

describe('RoutineEntryOccurrenceStatus', () => {
	const berlin = TimeZone.of('Europe/Berlin')
	/** Monday 2026-10-19, 12:00 in Berlin. */
	const now = new Date('2026-10-19T10:00:00Z')
	const at = (iso: string) => new DateTime(iso)
	const entry = (type: EntryType, iso: string, init: Partial<Entry> = {}) => new Entry({ id: 'e', sourceId: 's', type, heading: 'Gym', start: at(iso), end: at(iso).add({ hours: 1 }), ...init })
	const statusOf = (type: EntryType, iso: string, init: Partial<Entry> = {}) => RoutineEntryOccurrenceStatus.of(entry(type, iso, init).occurrences.single, now, berlin)

	it('reads a task done as kept, open past its day as missed, open today as open, and still to come as upcoming', () => {
		assert.deepEqual([
			statusOf(EntryType.Task, '2026-10-17T06:00:00Z', { status: EntryStatus.Done }),
			statusOf(EntryType.Task, '2026-10-18T06:00:00Z'),
			statusOf(EntryType.Task, '2026-10-19T06:00:00Z'),
			statusOf(EntryType.Task, '2026-10-20T06:00:00Z'),
		], [RoutineEntryOccurrenceStatus.Kept, RoutineEntryOccurrenceStatus.Missed, RoutineEntryOccurrenceStatus.Open, RoutineEntryOccurrenceStatus.Upcoming])
	})

	it('reads an event that stood as kept once it ended, one under way as open, and a cancelled one as cancelled', () => {
		assert.deepEqual([
			statusOf(EntryType.Event, '2026-10-12T16:00:00Z'),
			statusOf(EntryType.Event, '2026-10-19T07:00:00Z'),
			statusOf(EntryType.Event, '2026-10-19T16:00:00Z'),
			statusOf(EntryType.Event, '2026-10-13T16:00:00Z', { status: EntryStatus.Cancelled }),
		], [RoutineEntryOccurrenceStatus.Kept, RoutineEntryOccurrenceStatus.Kept, RoutineEntryOccurrenceStatus.Open, RoutineEntryOccurrenceStatus.Cancelled])
	})

	it('reads the day in the zone it is given: late on Sunday in Berlin is Sunday, not Monday', () => {
		assert.equal(statusOf(EntryType.Task, '2026-10-18T21:30:00Z'), RoutineEntryOccurrenceStatus.Missed)
		assert.equal(statusOf(EntryType.Task, '2026-10-18T22:30:00Z'), RoutineEntryOccurrenceStatus.Open, 'half past midnight on Monday there')
	})

	it('is none without a date', () => {
		assert.equal(RoutineEntryOccurrenceStatus.of(new Entry({ sourceId: 's', type: EntryType.Task }).occurrences.single, now, berlin), undefined)
	})

	it('settles as kept, cancelled or missed, and reads as its code', () => {
		assert.deepEqual(RoutineEntryOccurrenceStatus.all.filter(status => status.settled).map(String), ['kept', 'cancelled', 'missed'])
	})
})
