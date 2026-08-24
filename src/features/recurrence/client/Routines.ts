import { type DateTime } from '@3mo/date-time'
import { type Entry } from '../../entries/Entry.js'
import { type EntrySegment } from '../../entries/client/EntrySegment.js'
import { EntrySegments } from '../../entries/client/EntrySegments.js'
import { EntryStore } from '../../entries/client/EntryStore.js'

/** The row unit a grid view stacks: the month view a strip of weeks, the year view a strip of months. */
export type RoutineUnit = 'week' | 'month'

/** One collapsed series as a view draws it across a single row: a mark per day it falls on. */
export interface RoutineRun {
	/** The first instance in range, for identity, color, and heading. */
	readonly segment: EntrySegment
	/** Epoch-ms day of every instance inside the queried range, ascending. */
	readonly days: ReadonlyArray<number>
}

/** Days per row unit, and the row count threshold for collapse (see AGENTS.md "Routines"). */
const UNITS: Record<RoutineUnit, { readonly days: number, readonly rows: number }> = {
	week: { days: 7, rows: 5 },
	month: { days: 30.436875, rows: 12 },
}

interface Series {
	readonly instances: Array<{ readonly day: number, readonly entry: Entry }>
	stride: number
}

/**
 * Computes which recurring series collapse into hairline marks at the current view scale, and their
 * per-row runs. See AGENTS.md "Routines".
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

	private _collapsed?: ReadonlyMap<string, Series>
	private get collapsed(): ReadonlyMap<string, Series> {
		if (this._collapsed) {
			return this._collapsed
		}
		const { days: unitDays, rows } = UNITS[this.unit]
		const from = this.days[0]?.dayStart.valueOf()
		const to = this.days.at(-1)?.dayStart.valueOf()
		const series = new Map<string, Series>()
		for (const entry of this.entries) {
			const master = entry.recurrenceMasterId
			// Preview ghosts must render as bars for drag feedback.
			if (!master || !entry.start || EntryStore.isPreview(entry)) {
				continue
			}
			const day = entry.start.dayStart.valueOf()
			if (from === undefined || to === undefined || day < from || day > to) {
				continue
			}
			const found = series.get(master)
			// Synced overrides carry no rule; take the stride from any occurrence that has one.
			const stride = entry.recurrence?.strideDays ?? Infinity
			if (found) {
				found.instances.push({ day, entry })
				found.stride = Math.min(found.stride, stride)
			} else {
				series.set(master, { instances: [{ day, entry }], stride })
			}
		}
		const collapsed = new Map<string, Series>()
		for (const [master, found] of series) {
			if (found.stride < unitDays && found.instances.length > rows) {
				collapsed.set(master, found)
			}
		}
		this.adopt(collapsed, from, to)
		for (const found of collapsed.values()) {
			found.instances.sort((a, b) => a.day - b.day)
		}
		return this._collapsed = collapsed
	}

	/**
	 * Matches detached standalone occurrences ("this entry only") to existing collapsed routines by
	 * appearance `(sourceId, allDay, heading)` so they render as marks. See AGENTS.md "Routines".
	 */
	private adopt(collapsed: Map<string, Series>, from: number | undefined, to: number | undefined) {
		if (collapsed.size === 0 || from === undefined || to === undefined) {
			return
		}
		const key = (entry: Entry) => `${entry.sourceId}\u0000${!!entry.allDay}\u0000${entry.heading.trim().toLowerCase()}`
		const byAppearance = new Map<string, Series>()
		for (const series of collapsed.values()) {
			const sample = series.instances[0]!.entry
			// Blank headings are ignored to avoid false matches.
			if (sample.heading.trim()) {
				byAppearance.set(key(sample), series)
			}
		}
		for (const entry of this.entries) {
			if (entry.recurrenceMasterId || entry.recurrence || !entry.start || !entry.heading.trim() || EntryStore.isPreview(entry)) {
				continue
			}
			const day = entry.start.dayStart.valueOf()
			if (day < from || day > to) {
				continue
			}
			const series = byAppearance.get(key(entry))
			if (series) {
				series.instances.push({ day, entry })
				this.adopted.add(entry)
			}
		}
	}

	private readonly adopted = new Set<Entry>()

	/** Whether this entry collapses to routine marks. Previews never collapse. */
	collapses(entry: Entry): boolean {
		const collapsed = this.collapsed // populates adopted entries during resolution
		if (EntryStore.isPreview(entry)) {
			return false
		}
		return entry.recurrenceMasterId ? collapsed.has(entry.recurrenceMasterId) : this.adopted.has(entry)
	}

	/** The entries that still render as bars. Returns the input array unchanged when nothing collapses. */
	private _kept?: ReadonlyArray<Entry>
	get kept(): ReadonlyArray<Entry> {
		return this._kept ??= this.collapsed.size === 0
			? this.entries
			: this.entries.filter(entry => !this.collapses(entry))
	}

	/** Every collapsed series touching [from, to] with its active days, sorted by start day for deterministic packing. */
	runsIn(from: DateTime, to: DateTime): ReadonlyArray<RoutineRun> {
		const fromValue = from.dayStart.valueOf()
		const toValue = to.dayStart.valueOf()
		const runs = new Array<RoutineRun>()
		for (const series of this.collapsed.values()) {
			const inRange = series.instances.filter(instance => instance.day >= fromValue && instance.day <= toValue)
			if (inRange.length) {
				runs.push({ segment: EntrySegments.for(inRange[0]!.entry)[0]!, days: inRange.map(instance => instance.day) })
			}
		}
		return runs.sort((a, b) => a.days[0]! - b.days[0]! || a.days.at(-1)! - b.days.at(-1)!)
	}
}
