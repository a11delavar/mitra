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

interface Routine {
	readonly instances: Array<{ readonly day: number, readonly entry: Entry }>
	/** Smallest authored rule stride among members (`Infinity` if unruled). */
	stride: number
	/** Master IDs belonging to this routine. */
	readonly masters: Set<string>
}

/** Routine identity key: (sourceId, heading) — deliberately not allDay: an all-day placeholder
 * becomes timed once the appointment is booked, and stays the same habit. Undefined for empty titles. */
function appearance(entry: Entry): string | undefined {
	const heading = entry.heading.trim().toLowerCase()
	return heading ? `${entry.sourceId} ${heading}` : undefined
}

/** Median day gap across distinct days, providing robust cadence for unruled or pooled cohorts. */
function observedStride(instances: ReadonlyArray<{ readonly day: number }>): number {
	const days = [...new Set(instances.map(instance => instance.day))].sort((a, b) => a - b)
	if (days.length < 2) {
		return Infinity
	}
	// Round to whole days to handle 23h/25h DST boundaries.
	const gaps = days.slice(1).map((day, index) => Math.round((day - days[index]!) / DAY)).sort((a, b) => a - b)
	const middle = gaps.length >> 1
	return gaps.length % 2 ? gaps[middle]! : (gaps[middle - 1]! + gaps[middle]!) / 2
}

/**
 * Computes which routines collapse into ribbon marks and their per-row runs.
 * Pools recurring series, overrides, and detached instances by appearance `(sourceId, allDay, heading)`.
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
		const { days: unitDays, slack } = UNITS[this.unit]
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
			const master = entry.recurrenceMasterId
			// Skip unexpanded recurrence masters; occurrences are already expanded.
			if (!master && entry.recurrence) {
				continue
			}
			const key = appearance(entry) ?? master // blank standalones are ignored
			if (!key) {
				continue
			}
			// Take stride from any member with a rule.
			const stride = entry.recurrence?.strideDays ?? Infinity
			const found = routines.get(key)
			if (found) {
				found.instances.push({ day, entry })
				found.stride = Math.min(found.stride, stride)
				if (master) {
					found.masters.add(master)
				}
			} else {
				routines.set(key, { instances: [{ day, entry }], stride, masters: new Set(master ? [master] : []) })
			}
		}
		const collapsed = new Map<string, Routine>()
		for (const [key, found] of routines) {
			// Use the tighter of authored rule stride and observed day intervals.
			const stride = Math.min(found.stride, observedStride(found.instances))
			if (stride < unitDays * slack && found.instances.length >= MIN_INSTANCES) {
				collapsed.set(key, found)
				found.instances.sort((a, b) => a.day - b.day)
				for (const { entry } of found.instances) {
					if (!entry.recurrenceMasterId) {
						this.detached.add(entry)
					}
				}
				for (const master of found.masters) {
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
		return entry.recurrenceMasterId ? this.collapsedMasters.has(entry.recurrenceMasterId) : this.detached.has(entry)
	}

	/** The entries that still render as bars. Returns the input array unchanged when nothing collapses. */
	private _kept?: ReadonlyArray<Entry>
	get kept(): ReadonlyArray<Entry> {
		return this._kept ??= this.collapsed.size === 0
			? this.entries
			: this.entries.filter(entry => !this.collapses(entry))
	}

	/** Every collapsed routine touching [from, to] with its active days, sorted by start day for deterministic packing. */
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
		return runs.sort((a, b) => a.days[0]! - b.days[0]! || a.days.at(-1)! - b.days.at(-1)!)
	}
}
