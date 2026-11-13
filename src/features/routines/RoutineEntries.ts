import { DateTime, DateTimeRange } from '@3mo/date-time'
import type { Entry } from '#features/entries'
import { EntryOccurrences } from '#features/recurrence'
import type { TimeZone } from '#features/time/TimeZone.js'
import { RoutineEntryOccurrences } from './RoutineEntryOccurrences.js'

/**
 * A routine's entries: those naming it, each recurring one with its overrides inside it, which stand in for its dates
 * whatever routine they name, so an override naming it is no entry of its own beside its recurring entry.
 */
export class RoutineEntries {
	static of(members: ReadonlyArray<Entry>) {
		const recurring = new Set(members.filter(member => member.recurrence?.freq && !member.recurringEntryId).map(member => member.id))
		return new RoutineEntries(members.filter(member => !member.recurringEntryId || !recurring.has(member.recurringEntryId)))
	}

	private constructor(private readonly entries: ReadonlyArray<Entry>) { }

	/**
	 * Its dates read at `now` in the days of `zone`, from its first: what the rules yield less what they exclude, and the
	 * entries of their own. Through a year and a day past `now`, which reaches the next date of anything that comes at least
	 * once a year.
	 */
	occurrencesAt(now: Date, zone: TimeZone) {
		// Read from the database, an entry's dates are plain `Date`s, typed `DateTime` though they are.
		const first = this.entries.flatMap(entry => entry.start ?? entry.due ?? []).map(date => new DateTime(date)).reduce<DateTime | undefined>((earliest, date) => earliest?.isBefore(date) ? earliest : date, undefined)
		const window = first && new DateTimeRange(first, new DateTime(now).add({ years: 1, days: 1 }))
		return RoutineEntryOccurrences.of(window ? EntryOccurrences.within(this.entries, window) : [], now, zone)
	}

	/** The recurring entry with the tightest rule, which says best how often it comes. */
	get tightest() {
		return this.entries.filter(entry => entry.recurrence?.freq).sort((a, b) => a.recurrence!.strideDays - b.recurrence!.strideDays)[0]
	}
}
