import { type DateTime } from '@3mo/date-time'
import type { EntryOccurrence } from '#features/recurrence'
import { type EntrySegment } from '#features/entries/client/EntrySegment.js'
import { EntrySegments } from '#features/entries/client/EntrySegments.js'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import type { RoutineUnit } from '../RoutineCadence.js'
import type { Routine } from '../Routine.js'
import { RoutineStore } from './RoutineStore.js'

/** One collapsed routine as a view draws it across a single row: a mark per day it falls on. */
export interface RoutineRun {
	/** The first instance in range, for identity, color, and heading. */
	readonly segment: EntrySegment
	/** Epoch-ms of every active day inside the queried range, ascending, each day once. */
	readonly days: ReadonlyArray<number>
}

/**
 * Which occurrences collapse into routine marks, and their runs per row. Membership and cadence are the server's
 * (`Entry.routineId`, `GET /routines`), so nothing here depends on the window a view happens to show: a routine collapses
 * where it comes more often than the row.
 */
export class Routines {
	private static readonly cache = new WeakMap<ReadonlyArray<DateTime>, Routines>()

	/** The cohort for these inputs, memoised on `days`. */
	static of(occurrences: ReadonlyArray<EntryOccurrence>, days: ReadonlyArray<DateTime>, unit: RoutineUnit, routines: ReadonlyMap<string, Routine> = RoutineStore.routines): Routines {
		const cached = Routines.cache.get(days)
		if (cached?.occurrences === occurrences && cached.unit === unit && cached.routines === routines) {
			return cached
		}
		const cohort = new Routines(occurrences, days, unit, routines)
		Routines.cache.set(days, cohort)
		return cohort
	}

	/** The routine an occurrence belongs to: its own row's, else its recurring entry's. */
	static idOf(occurrence: EntryOccurrence) {
		return occurrence.entry.routineId ?? occurrence.recurringEntry?.routineId
	}

	constructor(
		readonly occurrences: ReadonlyArray<EntryOccurrence>,
		readonly days: ReadonlyArray<DateTime>,
		readonly unit: RoutineUnit,
		readonly routines: ReadonlyMap<string, Routine>,
	) { }

	/** Whether this occurrence collapses to routine marks. Previews never collapse, so a drag shows its bar. */
	collapses(occurrence: EntryOccurrence): boolean {
		// A recurring entry whose rule yields nothing shows once, as an entry of its own would.
		if (!occurrence.start || EntryStore.pending.isPreview(occurrence.entry) || (!occurrence.recurring && occurrence.entry.recurrence)) {
			return false
		}
		const id = Routines.idOf(occurrence)
		return id !== undefined && !!this.routines.get(id)?.cadence?.collapsesIn(this.unit)
	}

	/** Each collapsed routine's instances inside the window, by day. */
	private _collapsed?: ReadonlyMap<string, ReadonlyArray<{ readonly day: number, readonly occurrence: EntryOccurrence }>>
	private get collapsed() {
		if (this._collapsed) {
			return this._collapsed
		}
		const from = this.days[0]?.dayStart.valueOf() ?? Infinity
		const to = this.days.at(-1)?.dayStart.valueOf() ?? -Infinity
		const collapsed = new Map<string, Array<{ readonly day: number, readonly occurrence: EntryOccurrence }>>()
		for (const occurrence of this.occurrences) {
			const day = occurrence.start?.dayStart.valueOf()
			if (day === undefined || day < from || day > to || !this.collapses(occurrence)) {
				continue
			}
			const id = Routines.idOf(occurrence)!
			const instances = collapsed.get(id) ?? []
			instances.push({ day, occurrence })
			collapsed.set(id, instances)
		}
		for (const instances of collapsed.values()) {
			instances.sort((a, b) => a.day - b.day)
		}
		return this._collapsed = collapsed
	}

	/** The occurrences that still render as bars. Returns the input array unchanged when nothing collapses. */
	private _kept?: ReadonlyArray<EntryOccurrence>
	get kept(): ReadonlyArray<EntryOccurrence> {
		if (this._kept) {
			return this._kept
		}
		const kept = this.occurrences.filter(occurrence => !this.collapses(occurrence))
		return this._kept = kept.length === this.occurrences.length ? this.occurrences : kept
	}

	/**
	 * Every collapsed routine touching [from, to] with its active days, sorted by start day, then by identity (calendar and
	 * heading) so ties never follow the order the entries arrived in.
	 */
	runsIn(from: DateTime, to: DateTime): ReadonlyArray<RoutineRun> {
		const fromValue = from.dayStart.valueOf()
		const toValue = to.dayStart.valueOf()
		const runs = new Array<RoutineRun>()
		for (const instances of this.collapsed.values()) {
			const inRange = instances.filter(instance => instance.day >= fromValue && instance.day <= toValue)
			if (inRange.length) {
				// One mark per day, not per instance: a twice-daily routine would otherwise place two marks
				// in one grid column, and the extra implicit row collapses the ribbon to zero height.
				const days = [...new Set(inRange.map(instance => instance.day))]
				runs.push({ segment: EntrySegments.for(inRange[0]!.occurrence)[0]!, days })
			}
		}
		return runs.sort((a, b) => a.days[0]! - b.days[0]! || a.days.at(-1)! - b.days.at(-1)!
			|| a.segment.entry.heading.localeCompare(b.segment.entry.heading)
			|| String(a.segment.entry.sourceId).localeCompare(String(b.segment.entry.sourceId)))
	}
}
