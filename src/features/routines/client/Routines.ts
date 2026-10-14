import { type DateTime } from '@3mo/date-time'
import { type Entry } from '../../entries/Entry.js'
import { type EntrySegment } from '../../entries/client/EntrySegment.js'
import { EntrySegments } from '../../entries/client/EntrySegments.js'
import { EntryStore } from '../../entries/client/EntryStore.js'

/** The row unit a grid view stacks: the month view a strip of weeks, the year view a strip of months. */
export type RoutineUnit = 'week' | 'month'

/** One collapsed routine as a view draws it across a single row: a mark per day it falls on. */
export interface RoutineRun {
	/** The first instance in range, for identity, color, and heading. */
	readonly segment: EntrySegment
	/** Epoch-ms of every active day inside the queried range, ascending, each day once. */
	readonly days: ReadonlyArray<number>
}

/** Days per row unit and cadence slack factor for density collapse. */
const UNITS: Record<RoutineUnit, { readonly days: number, readonly slack: number }> = {
	week: { days: 7, slack: 1 },
	month: { days: 30.436875, slack: 1.25 },
}

/** Minimum occurrences in range to qualify as a routine. */
const MIN_INSTANCES = 4

const DAY = 86_400_000

/** A habit pooled from series, overrides and detached instances that share an appearance. */
class Routine {
	/**
	 * The appearance that pools entries, `(sourceId, heading)`, deliberately not allDay: an all-day placeholder becomes timed
	 * once the appointment is booked, and stays the same habit. None for an empty heading.
	 */
	static keyOf(entry: Entry): string | undefined {
		const heading = entry.heading.trim().toLowerCase()
		return heading ? `${entry.sourceId} ${heading}` : undefined
	}

	readonly instances = new Array<{ readonly day: number, readonly entry: Entry }>()
	/** The smallest stride its members' rules author, `Infinity` without one. */
	private authoredStride = Infinity
	/** Master ids belonging to this routine. */
	readonly masters = new Set<string>()

	add(day: number, entry: Entry) {
		this.instances.push({ day, entry })
		this.authoredStride = Math.min(this.authoredStride, entry.recurrence?.strideDays ?? Infinity)
		if (entry.recurringEntryId) {
			this.masters.add(entry.recurringEntryId)
		}
	}

	/** The median gap between its days, a cadence for unruled or pooled instances too. */
	private get observedStride(): number {
		const days = [...new Set(this.instances.map(instance => instance.day))].sort((a, b) => a - b)
		if (days.length < 2) {
			return Infinity
		}
		// Rounded to whole days, as a DST day lasts 23 or 25 hours.
		const gaps = days.slice(1).map((day, index) => Math.round((day - days[index]!) / DAY)).sort((a, b) => a - b)
		const middle = gaps.length >> 1
		return gaps.length % 2 ? gaps[middle]! : (gaps[middle - 1]! + gaps[middle]!) / 2
	}

	/** Whether it comes often enough to collapse in rows of `unit`, by the tighter of its authored and observed strides. */
	collapsesIn(unit: RoutineUnit) {
		const { days, slack } = UNITS[unit]
		return this.instances.length >= MIN_INSTANCES && Math.min(this.authoredStride, this.observedStride) < days * slack
	}
}

/**
 * Computes which routines collapse into ribbon marks and their per-row runs.
 * Pools recurring series, overrides, and detached instances by appearance (`Routine.keyOf`).
 */
export class Routines {
	private static readonly cache = new WeakMap<ReadonlyArray<DateTime>, Routines>()

	/** The cohort for these inputs, memoised on `days`. */
	static of(entries: ReadonlyArray<Entry>, days: ReadonlyArray<DateTime>, unit: RoutineUnit): Routines {
		const cached = Routines.cache.get(days)
		if (cached?.entries === entries && cached.unit === unit) {
			return cached
		}
		const cohort = new Routines(entries, days, unit)
		Routines.cache.set(days, cohort)
		return cohort
	}

	constructor(readonly entries: ReadonlyArray<Entry>, readonly days: ReadonlyArray<DateTime>, readonly unit: RoutineUnit) { }

	private _collapsed?: ReadonlyMap<string, Routine>
	private get collapsed(): ReadonlyMap<string, Routine> {
		if (this._collapsed) {
			return this._collapsed
		}
		const from = this.days[0]?.dayStart.valueOf()
		const to = this.days.at(-1)?.dayStart.valueOf()
		const routines = new Map<string, Routine>()
		for (const entry of this.entries) {
			// Preview ghosts must render as bars for drag feedback.
			if (!entry.start || EntryStore.isPreview(entry)) {
				continue
			}
			const day = entry.start.dayStart.valueOf()
			if (from === undefined || to === undefined || day < from || day > to) {
				continue
			}
			// Skip unexpanded recurrence masters; occurrences are already expanded.
			if (!entry.recurringEntryId && entry.recurrence) {
				continue
			}
			const key = Routine.keyOf(entry) ?? entry.recurringEntryId // blank standalones are ignored
			if (!key) {
				continue
			}
			const routine = routines.get(key) ?? new Routine()
			routines.set(key, routine)
			routine.add(day, entry)
		}
		const collapsed = new Map<string, Routine>()
		for (const [key, routine] of routines) {
			if (routine.collapsesIn(this.unit)) {
				collapsed.set(key, routine)
				routine.instances.sort((a, b) => a.day - b.day)
				for (const { entry } of routine.instances) {
					if (!entry.recurringEntryId) {
						this.detached.add(entry)
					}
				}
				for (const master of routine.masters) {
					this.collapsedMasters.add(master)
				}
			}
		}
		return this._collapsed = collapsed
	}

	/** Standalone instances that landed in a collapsed routine; filled in as `collapsed` resolves. */
	private readonly detached = new Set<Entry>()
	/** Master ids whose series is a member of a collapsed routine; filled in as `collapsed` resolves. */
	private readonly collapsedMasters = new Set<string>()

	/** Whether this entry collapses to routine marks. Previews never collapse. */
	collapses(entry: Entry): boolean {
		void this.collapsed // populates detached/collapsedMasters during resolution
		if (EntryStore.isPreview(entry)) {
			return false
		}
		return entry.recurringEntryId ? this.collapsedMasters.has(entry.recurringEntryId) : this.detached.has(entry)
	}

	/** The entries that still render as bars. Returns the input array unchanged when nothing collapses. */
	private _kept?: ReadonlyArray<Entry>
	get kept(): ReadonlyArray<Entry> {
		return this._kept ??= this.collapsed.size === 0
			? this.entries
			: this.entries.filter(entry => !this.collapses(entry))
	}

	/**
	 * Every collapsed routine touching [from, to] with its active days, sorted by start day, then by identity (calendar and
	 * heading) so ties never follow the order the entries arrived in.
	 */
	runsIn(from: DateTime, to: DateTime): ReadonlyArray<RoutineRun> {
		const fromValue = from.dayStart.valueOf()
		const toValue = to.dayStart.valueOf()
		const runs = new Array<RoutineRun>()
		for (const routine of this.collapsed.values()) {
			const inRange = routine.instances.filter(instance => instance.day >= fromValue && instance.day <= toValue)
			if (inRange.length) {
				// One mark per day, not per instance: a twice-daily routine would otherwise place two marks
				// in one grid column, and the extra implicit row collapses the ribbon to zero height.
				const days = [...new Set(inRange.map(instance => instance.day))]
				runs.push({ segment: EntrySegments.for(inRange[0]!.entry)[0]!, days })
			}
		}
		return runs.sort((a, b) => a.days[0]! - b.days[0]! || a.days.at(-1)! - b.days.at(-1)!
			|| a.segment.entry.heading.localeCompare(b.segment.entry.heading)
			|| String(a.segment.entry.sourceId).localeCompare(String(b.segment.entry.sourceId)))
	}
}
