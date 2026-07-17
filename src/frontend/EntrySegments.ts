import { type DateTime } from '@3mo/date-time'
import type { Entry } from 'shared'
import { EntrySegment } from './EntrySegment.js'
import { EntryStore } from './EntryStore.js'

/** An event placed in a month-grid week: a column-spanning bar at its packed slot (row). */
export interface MonthBar {
	readonly segment: EntrySegment
	readonly startColumn: number
	readonly span: number
	readonly slot: number
	/** The run continues past this week's trailing edge — the bar's end is clipped, not the run's real end
	 * (so a resize handle there would target the wrong day; the view hides it via `has-next`). */
	readonly clippedRight: boolean
}

/** A week of the month grid: the bars that fit, and per-column counts of the ones that didn't. */
export interface MonthWeek {
	readonly bars: ReadonlyArray<MonthBar>
	readonly hiddenByColumn: ReadonlyArray<number>
}

/**
 * The view-layer's whole "layout engine" — and it's small, because CSS grid does the placing. Given a
 * set of entries over a window of days it answers three things the views ask for:
 *
 * - `for(entry)` — the entry's per-day segments, linked and memoised (stable identity across renders).
 * - `timedOn(day)` — that day's timed segments, laid out by the group/level cascade model (see
 *   `cluster`): near-simultaneous starts split side-by-side, later starts ride on top.
 *   This is the *one* genuinely cross-segment computation; everything else a segment derives itself.
 * - `runsIn(from, to, accept)` — one representative segment per matching entry whose run touches the
 *   window, sorted for CSS `grid-auto-flow: dense` to pack into lanes. Used for the all-day lane and,
 *   per week, the month grid — the view turns each into a column span from the segment's own dates.
 */
export class EntrySegments {
	private static readonly perEntry = new WeakMap<Entry, { readonly spanKey: string, readonly segments: ReadonlyArray<EntrySegment> }>()

	/** The slice-relevant projection of an entry's span. Entry instances are stable and mutated in place
	 * (see `EntryStore`), so the memo can't key on identity alone — it re-validates against this. */
	private static spanKey(entry: Entry) {
		return `${entry.start?.valueOf()}:${entry.end?.valueOf()}:${!!entry.allDay}`
	}

	/** An entry's per-day slices, linked previous↔next, memoised so instances are stable across renders —
	 * and re-sliced the moment the entry's span drifts, so an in-place edit renders instantly. Content
	 * changes (heading, color, status) keep the same segments; they read those live off the entry. */
	static for(entry: Entry): ReadonlyArray<EntrySegment> {
		const spanKey = EntrySegments.spanKey(entry)
		let memo = EntrySegments.perEntry.get(entry)
		if (memo?.spanKey !== spanKey) {
			memo = { spanKey, segments: EntrySegments.slice(entry) }
			EntrySegments.perEntry.set(entry, memo)
		}
		return memo.segments
	}

	private static slice(entry: Entry): ReadonlyArray<EntrySegment> {
		if (!entry.start || !entry.end) {
			return [new EntrySegment(entry)]
		}
		const startDay = entry.start.dayStart
		const endDay = entry.end.dayStart
		if (startDay.equals(endDay) || (entry.end.hour === 0 && entry.end.minute === 0 && startDay.equals(endDay.subtract({ days: 1 })))) {
			return [new EntrySegment(entry, startDay)]
		}
		const segments = new Array<EntrySegment>()
		let day = startDay
		while (day.isBefore(endDay) || (day.equals(endDay) && (entry.end.hour > 0 || entry.end.minute > 0))) {
			const segment = new EntrySegment(entry, day)
			const previous = segments.at(-1)
			if (previous) {
				previous.next = segment
				segment.previous = previous
			}
			segments.push(segment)
			day = day.add({ days: 1 })
		}
		return segments
	}

	private static readonly cache = new WeakMap<ReadonlyArray<DateTime>, EntrySegments>()

	/** The cohort for these inputs, reused until `entries`/`days` change (keyed weakly on `days`). */
	static of(entries: ReadonlyArray<Entry>, days: ReadonlyArray<DateTime>): EntrySegments {
		const cached = EntrySegments.cache.get(days)
		if (cached?.entries === entries) {
			return cached
		}
		const cohort = new EntrySegments(entries, days)
		EntrySegments.cache.set(days, cohort)
		return cohort
	}

	constructor(readonly entries: ReadonlyArray<Entry>, readonly days: ReadonlyArray<DateTime>) { }

	/** The non-all-day segments, computed once per cohort (each `for` is itself memoised). */
	private _timedSegments?: ReadonlyArray<EntrySegment>
	private get timedSegments() {
		return this._timedSegments ??= this.entries.filter(entry => !entry.allDay).flatMap(entry => EntrySegments.for(entry))
	}

	private readonly timedCache = new Map<number, ReadonlyArray<EntrySegment>>()
	/** This day's timed (non-all-day) segments, clustered into side-by-side columns. A move's ghost
	 * renders in the day but stays invisible to the packing: it and the entry it previews are the same
	 * thing, so nothing may fold aside to make room for it — it floats above instead. */
	timedOn(date: DateTime): ReadonlyArray<EntrySegment> {
		const key = date.dayStart.valueOf() // one Temporal op per day; the filter below is pure integer math
		let segments = this.timedCache.get(key)
		if (!segments) {
			const day = this.timedSegments.filter(segment => segment.fallsOn(key))
			const isOverlay = (segment: EntrySegment) => EntryStore.isPreview(segment.entry)
			segments = [...EntrySegments.cluster(day.filter(segment => !isOverlay(segment))), ...day.filter(isOverlay)]
			this.timedCache.set(key, segments)
		}
		return segments
	}

	/** One segment per accepted entry whose run touches [from, to] — its first slice in range — sorted
	 * (earliest, then longest run first) so DOM order drives `grid-auto-flow: dense` lane packing. */
	runsIn(from: DateTime, to: DateTime, accept: (entry: Entry) => boolean): ReadonlyArray<EntrySegment> {
		const fromValue = from.dayStart.valueOf()
		const toValue = to.dayStart.valueOf()
		const reps = new Array<EntrySegment>()
		for (const entry of this.entries) {
			if (!accept(entry)) {
				continue
			}
			const inRange = EntrySegments.for(entry).find(segment => segment.dayValue !== undefined && segment.dayValue >= fromValue && segment.dayValue <= toValue)
			if (inRange) {
				reps.push(inRange)
			}
		}
		const runDays = (segment: EntrySegment) => segment.runEnd.dayValue! - segment.dayValue!
		return reps.sort((a, b) => a.dayValue === b.dayValue
			? runDays(b) - runDays(a) // longest run first, so it claims the lowest lane
			: a.dayValue! - b.dayValue!)
	}

	/** Lane-ordering priority for the month packing, lowest first (closest to the top): multi-day spans,
	 * then single-day all-day, then timed, then undated — so spanning bars claim the top slots. (A view
	 * concern, hence here and not on the domain `Entry`.) */
	static laneRank(entry: Entry): number {
		if (!entry.start || !entry.end) {
			return 3
		}
		if (entry.multiDay) {
			return 0
		}
		return entry.allDay ? 1 : 2
	}

	/** A week of the month grid: each entry touching it as a column-spanning bar at its packed slot,
	 * plus the per-column counts of events pushed past `maxSlots` (the "+N more" overflow). */
	monthWeek(week: ReadonlyArray<DateTime>, maxSlots: number): MonthWeek {
		const weekStart = week[0]!
		const weekEnd = week[week.length - 1]!
		const weekEndValue = weekEnd.dayStart.valueOf()
		const lastSlot = maxSlots - 1 // the top slot is reserved for the "+N more" affordance
		// Built once per week so each bar's column is an O(1) numeric lookup, not a findIndex.
		const columnByDay = new Map(week.map((day, index) => [day.dayStart.valueOf(), index]))
		const columnOf = (dayValue: number) => columnByDay.get(dayValue) ?? -1

		const bars = new Array<MonthBar>()
		const hiddenByColumn = new Array<number>(week.length).fill(0)
		for (const segment of this.runsIn(weekStart, weekEnd, () => true)) {
			const startColumn = columnOf(segment.dayValue!)
			const clippedRight = segment.runEnd.dayValue! > weekEndValue
			const endColumn = clippedRight ? week.length - 1 : columnOf(segment.runEnd.dayValue!)
			if (startColumn < 0 || endColumn < 0) {
				continue
			}
			const slot = this.monthSlots.get(segment.entry) ?? 0
			if (slot >= lastSlot) {
				for (let column = startColumn; column <= endColumn; column++) {
					hiddenByColumn[column] = (hiddenByColumn[column] ?? 0) + 1
				}
				continue
			}
			bars.push({ segment, startColumn, span: endColumn - startColumn + 1, slot, clippedRight })
		}
		return { bars, hiddenByColumn }
	}

	/** Each dated entry's shared lane (slot) across all its days, packing non-overlapping events into the
	 * same row — ordered by `Entry.laneRank` so spanning bars sit on top. The month view needs this rather
	 * than CSS auto-flow because its "+N more" overflow has to know exactly which events fall past the cap. */
	private _monthSlots?: ReadonlyMap<Entry, number>
	get monthSlots(): ReadonlyMap<Entry, number> {
		if (this._monthSlots) {
			return this._monthSlots
		}
		const datesByEntry = new Map<Entry, ReadonlyArray<number>>()
		for (const entry of this.entries) {
			if (EntryStore.isPreview(entry)) {
				continue // a move's ghost overlays slot 0 (see monthWeek's fallback) — it mustn't shift lanes
			}
			const dates = EntrySegments.for(entry).map(s => s.dayValue).filter((v): v is number => v !== undefined)
			if (dates.length) {
				datesByEntry.set(entry, dates)
			}
		}

		const ordered = [...datesByEntry.keys()].sort((a, b) => {
			const rankA = EntrySegments.laneRank(a)
			const rankB = EntrySegments.laneRank(b)
			if (rankA !== rankB) return rankA - rankB
			if (!a.start || !b.start || !a.end || !b.end) return 0
			if (!a.start.equals(b.start)) return a.start.isBefore(b.start) ? -1 : 1
			if (!a.end.equals(b.end)) return a.end.isAfter(b.end) ? -1 : 1
			return 0
		})

		const slots = new Map<Entry, number>()
		const rows = new Array<Set<number>>()
		for (const entry of ordered) {
			const dates = datesByEntry.get(entry)!
			let slot = rows.findIndex(row => dates.every(date => !row.has(date)))
			if (slot === -1) {
				slot = rows.length
				rows.push(new Set())
			}
			dates.forEach(date => rows[slot]!.add(date))
			slots.set(entry, slot)
		}
		return this._monthSlots = slots
	}

	// — the one per-day cross-segment computation: how overlapping timed events share the width —

	/** Minutes a group's base must have been running before a newcomer may cascade over it; closer
	 * starts split side-by-side instead. THE columns-vs-cascade dial of this layout family (compare
	 * `minimumStartDifference` in react-big-calendar's Google-style algorithm). */
	static readonly overlayHeadroomMinutes = 45

	/** Minutes a cascading chip must start after an intersecting chip of its own tier to cover it;
	 * closer starts share the tier side-by-side ("leaves") — smaller than the base headroom because
	 * a chip's covered header is compact where a base block's title may wrap over several lines. */
	static readonly overlayCascadeGapMinutes = 30

	/** Rendered cascade depth is capped — beyond this the per-level indents eat the chip width. */
	private static readonly maxInset = 4

	/**
	 * The group/level model — the container–row–leaf cascade of Google/Notion Calendar. The START
	 * of a segment decides its fate, never its extent:
	 *
	 * - A segment starting at/after everything before it has ended ANCHORS a new full-width group.
	 * - A segment starting while the group's base runs either joins the base side-by-side (a MATE,
	 *   crisp columns — when no base mate has been running for `overlayHeadroomMinutes` yet), or
	 *   CASCADES as a row above the longest-running such mate. A row's tail may poke past the group;
	 *   it does NOT extend the group's span, so a later segment anchors a fresh full-width group
	 *   that paints ABOVE the tail — paint order is start order (DOM order, see Day.ts) — and the
	 *   tail slides underneath it instead of burying it.
	 * - Rows sit one level deeper than the deepest row they intersect — of ANY group, so a foreign
	 *   tail can never tie on depth — except a row starting within `overlayCascadeGapMinutes` of a
	 *   row it covers shares that row's level side-by-side instead of burying its header.
	 *
	 * Multi-day continuations would anchor a group spanning the whole day and swallow everything;
	 * they render as a full-height backdrop layer instead (columns among themselves), with the
	 * day's own chips grouped independently above them.
	 */
	private static cluster(segments: ReadonlyArray<EntrySegment>): ReadonlyArray<EntrySegment> {
		const sorted = [...segments].sort((a, b) => a.startMinute !== b.startMinute
			? a.startMinute - b.startMinute
			: (b.endMinute - b.startMinute) - (a.endMinute - a.startMinute))
		const backdrop = sorted.filter(segment => segment.allDay)
		const chips = sorted.filter(segment => !segment.allDay)
		EntrySegments.columns(backdrop, 0)

		interface Row { readonly segment: EntrySegment, readonly level: number, readonly host: EntrySegment }
		interface Group { readonly mates: Array<EntrySegment>, readonly rows: Array<Row>, end: number }
		const groups = new Array<Group>()
		const rows = new Array<Row>() // across groups — a foreign tail must stack, never tie
		let group: Group | undefined
		for (const segment of chips) {
			if (!group || segment.startMinute >= group.end) {
				group = { mates: [segment], rows: [], end: segment.endMinute }
				groups.push(group)
				continue
			}
			// The still-running mates past their headroom. The group's span guarantees some mate is
			// still running (end = max of mate ends > this start, and every mate started earlier),
			// so only the headroom can disqualify them all — folding the newcomer into the mates.
			const hosts = group.mates.filter(mate => mate.endMinute > segment.startMinute
				&& mate.startMinute + EntrySegments.overlayHeadroomMinutes <= segment.startMinute)
			// A row it would cover too soon after that row's own start (its header would vanish):
			// share that row's level side-by-side instead — or, over a split base, fold to the mates.
			const collided = group.rows.find(row => row.segment.overlaps(segment)
				&& row.segment.startMinute + EntrySegments.overlayCascadeGapMinutes > segment.startMinute)
			if (!hosts.length || (collided && group.mates.length > 1)) {
				group.mates.push(segment)
				group.end = Math.max(group.end, segment.endMinute)
				continue
			}
			const host = hosts.reduce((a, b) => b.endMinute >= a.endMinute ? b : a)
			const level = collided?.level ?? 1 + Math.max(0, ...rows.filter(row => row.segment.overlaps(segment)).map(row => row.level))
			const row: Row = { segment, level, host }
			group.rows.push(row)
			rows.push(row)
		}

		for (const g of groups) {
			EntrySegments.columns(g.mates, 0)
			if (g.mates.length === 1) {
				const levels = new Map<number, Array<EntrySegment>>()
				for (const row of g.rows) {
					const members = levels.get(row.level)
					if (members) {
						members.push(row.segment)
					} else {
						levels.set(row.level, [row.segment])
					}
				}
				for (const [level, members] of levels) {
					EntrySegments.columns(members, Math.min(level, EntrySegments.maxInset))
				}
			} else {
				// Rows over a split base ride their host mate's column instead of a level of their own.
				for (const row of g.rows) {
					row.segment.overlap = { ...row.host.overlap!, inset: Math.min(row.level, EntrySegments.maxInset) }
				}
			}
		}
		return [...backdrop, ...chips] // backdrop first — the day's own chips paint above it
	}

	/** The greedy side-by-side pass shared by every tier — group mates, cascade levels, and the
	 * backdrop: first-fit columns, then each member widens rightward through columns that stay free
	 * for its whole span. Members must arrive sorted by start. */
	private static columns(segments: ReadonlyArray<EntrySegment>, inset: number): void {
		const columns = new Array<Array<EntrySegment>>()
		const slotOf = new Map<EntrySegment, number>()
		for (const segment of segments) {
			const column = columns.find(c => c.at(-1)!.endMinute <= segment.startMinute)
			if (column) {
				column.push(segment)
				slotOf.set(segment, columns.indexOf(column))
			} else {
				slotOf.set(segment, columns.length)
				columns.push([segment])
			}
		}
		const total = columns.length
		for (const segment of segments) {
			const slot = slotOf.get(segment)!
			let span = 1
			while (slot + span < total && !columns[slot + span]!.some(other => other.overlaps(segment))) {
				span++
			}
			segment.overlap = { slot, total, span, inset }
		}
	}
}
