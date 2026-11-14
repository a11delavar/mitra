import type { EntryOccurrence } from '#features/recurrence'
import type { TimeZone } from '#features/time/TimeZone.js'
import { RoutineEntryOccurrenceStatus } from './RoutineEntryOccurrenceStatus.js'

/**
 * A routine's dates read at one moment, in the days of a zone, in order up to the first still to come: where each stands,
 * and what that adds up to. The dates are the entries' own occurrences; only their status is a routine's.
 */
export class RoutineEntryOccurrences {
	static of(occurrences: ReadonlyArray<EntryOccurrence>, now: Date, zone: TimeZone) {
		const statuses = new Map<EntryOccurrence, RoutineEntryOccurrenceStatus>()
		for (const occurrence of occurrences) {
			const status = RoutineEntryOccurrenceStatus.of(occurrence, now, zone)
			if (status) {
				statuses.set(occurrence, status)
			}
			if (status === RoutineEntryOccurrenceStatus.Upcoming) {
				break
			}
		}
		return new RoutineEntryOccurrences(statuses, zone)
	}

	private constructor(
		private readonly statuses: ReadonlyMap<EntryOccurrence, RoutineEntryOccurrenceStatus>,
		private readonly zone: TimeZone,
	) { }

	private get occurrences() {
		return [...this.statuses.keys()]
	}

	private get settledOccurrences() {
		return this.occurrences.filter(occurrence => this.statusOf(occurrence)?.settled)
	}

	/** Where one of its dates stands. */
	statusOf(occurrence: EntryOccurrence) {
		return this.statuses.get(occurrence)
	}

	/** Its last `count` dates to today, today's included. */
	last(count: number) {
		return this.occurrences.filter(occurrence => this.statusOf(occurrence) !== RoutineEntryOccurrenceStatus.Upcoming).slice(-count)
	}

	/** The date still to come or under way. */
	get next() {
		return this.occurrences.find(occurrence => !this.statusOf(occurrence)?.settled)
	}

	/** How many of its last `count` dates settled: kept, cancelled or missed. */
	settled(count: number) {
		return this.settledOccurrences.slice(-count).length
	}

	/** How many of its last `count` settled dates were kept: a cancelled one counts against it, as a missed one does. */
	kept(count: number) {
		return this.settledOccurrences.slice(-count).filter(occurrence => this.statusOf(occurrence) === RoutineEntryOccurrenceStatus.Kept).length
	}

	/** The weekday (ISO, Monday 1) with the most missed or cancelled dates after `from`, where three or more fell on it. */
	slipsAfter(from: Temporal.PlainDate) {
		const settled = this.settledOccurrences
			.map(occurrence => ({ day: occurrence.dayIn(this.zone)!, kept: this.statusOf(occurrence) === RoutineEntryOccurrenceStatus.Kept }))
			.filter(({ day }) => Temporal.PlainDate.compare(day, from) > 0)
		const tallies = [...Map.groupBy(settled, ({ day }) => day.dayOfWeek)]
			.map(([weekday, dates]) => ({ weekday, count: dates.filter(date => !date.kept).length, of: dates.length }))
		const most = tallies.sort((a, b) => b.count - a.count || a.weekday - b.weekday)[0]
		return most && most.count >= 3 ? most : undefined
	}
}
