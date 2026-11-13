import { DateTime } from '@3mo/date-time'
import type { EntryOccurrence } from '#features/recurrence'
import type { TimeZone } from '#features/time/TimeZone.js'

export type RoutineEntryOccurrenceStatusCode = 'upcoming' | 'open' | 'kept' | 'cancelled' | 'missed'

/**
 * Where a routine's date stands at one moment: still to come, today's, or settled as kept, cancelled or missed. A task is kept
 * once done and missed once its day passes undone; an event is kept once it ends. Read from the entry's own status and the
 * clock, never stored. One instance per status, so they compare by identity.
 */
export class RoutineEntryOccurrenceStatus {
	static readonly Upcoming = new RoutineEntryOccurrenceStatus('upcoming')
	static readonly Open = new RoutineEntryOccurrenceStatus('open')
	static readonly Kept = new RoutineEntryOccurrenceStatus('kept')
	static readonly Cancelled = new RoutineEntryOccurrenceStatus('cancelled')
	static readonly Missed = new RoutineEntryOccurrenceStatus('missed')

	static readonly all: ReadonlyArray<RoutineEntryOccurrenceStatus> = [
		RoutineEntryOccurrenceStatus.Upcoming, RoutineEntryOccurrenceStatus.Open,
		RoutineEntryOccurrenceStatus.Kept, RoutineEntryOccurrenceStatus.Cancelled, RoutineEntryOccurrenceStatus.Missed,
	]

	/** Where `occurrence` stands by `now`, its day and today read in `zone`; none without a date. */
	static of(occurrence: EntryOccurrence, now: Date, zone: TimeZone) {
		const day = occurrence.dayIn(zone)
		if (!day) {
			return undefined
		}
		const { entry } = occurrence
		const task = entry.type.isTask
		const days = Temporal.PlainDate.compare(day, zone.dayOf(now))
		// Read from the database, an entry's dates are plain `Date`s, typed `DateTime` though they are.
		const ended = !new DateTime((occurrence.end ?? occurrence.start ?? occurrence.due)!).isAfter(new DateTime(now))
		switch (true) {
			case entry.cancelled: return RoutineEntryOccurrenceStatus.Cancelled
			case task && entry.done: return RoutineEntryOccurrenceStatus.Kept
			case days > 0: return RoutineEntryOccurrenceStatus.Upcoming
			case task && days < 0: return RoutineEntryOccurrenceStatus.Missed
			case task: return RoutineEntryOccurrenceStatus.Open
			case days < 0 || ended: return RoutineEntryOccurrenceStatus.Kept
			default: return RoutineEntryOccurrenceStatus.Open
		}
	}

	private constructor(readonly code: RoutineEntryOccurrenceStatusCode) { }

	/** Kept, cancelled or missed: the date became something, as today's open one and one still to come have not yet. */
	get settled() {
		return this === RoutineEntryOccurrenceStatus.Kept || this === RoutineEntryOccurrenceStatus.Cancelled || this === RoutineEntryOccurrenceStatus.Missed
	}

	toString() {
		return this.code
	}
}
