import { type DateTime } from '@3mo/date-time'
import { type Entry } from '../Entry.js'
import { EntrySegment } from './EntrySegment.js'
import { EntryStore } from './EntryStore.js'

export interface MonthBar {
	readonly segment: EntrySegment
	readonly startColumn: number
	readonly span: number
	readonly slot: number
	readonly clippedRight: boolean
}

/** Week view data for month grid rendering. */
export interface MonthWeek {
	readonly bars: ReadonlyArray<MonthBar>
}

/**
 * Derives per-day segment slices, timed column clusters, and month/all-day lane slots.
 */
export class EntrySegments {
	private static readonly perEntry = new WeakMap<Entry, { readonly spanKey: string, readonly segments: ReadonlyArray<EntrySegment> }>()

	private static spanKey(entry: Entry) {
		return `${entry.start?.valueOf()}:${entry.end?.valueOf()}:${!!entry.allDay}`
	}

	/** Returns memoized per-day slices for an entry. */
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

	/** Returns cached or new EntrySegments cohort for given entries and days. */
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

	private _timedSegments?: ReadonlyArray<EntrySegment>
	private get timedSegments() {
		return this._timedSegments ??= this.entries.filter(entry => !entry.allDay).flatMap(entry => EntrySegments.for(entry))
	}

	private readonly timedCache = new Map<number, ReadonlyArray<EntrySegment>>()

	/** Clustered timed segments for the given day. */
	timedOn(date: DateTime): ReadonlyArray<EntrySegment> {
		const key = date.dayStart.valueOf()
		let segments = this.timedCache.get(key)
		if (!segments) {
			const day = this.timedSegments.filter(segment => segment.fallsOn(key))
			const isOverlay = (segment: EntrySegment) => EntryStore.isPreview(segment.entry)
			segments = [...EntrySegments.cluster(day.filter(segment => !isOverlay(segment))), ...day.filter(isOverlay)]
			this.timedCache.set(key, segments)
		}
		return segments
	}

	private _segmentsByDay?: ReadonlyMap<number, ReadonlyArray<EntrySegment>>
	private get segmentsByDay(): ReadonlyMap<number, ReadonlyArray<EntrySegment>> {
		if (!this._segmentsByDay) {
			const map = new Map<number, Array<EntrySegment>>()
			for (const entry of this.entries) {
				for (const segment of EntrySegments.for(entry)) {
					if (segment.dayValue !== undefined) {
						const list = map.get(segment.dayValue)
						list ? list.push(segment) : map.set(segment.dayValue, [segment])
					}
				}
			}
			this._segmentsByDay = map
		}
		return this._segmentsByDay
	}

	/** Returns representative segments whose run touches [from, to], ordered by start date and run length. */
	runsIn(from: DateTime, to: DateTime, accept: (entry: Entry) => boolean): ReadonlyArray<EntrySegment> {
		const fromValue = from.dayStart.valueOf()
		const toValue = to.dayStart.valueOf()
		const byEntry = new Map<Entry, EntrySegment>()
		for (const [dayValue, segments] of this.segmentsByDay) {
			if (dayValue < fromValue || dayValue > toValue) {
				continue
			}
			for (const segment of segments) {
				const kept = byEntry.get(segment.entry)
				if ((!kept || segment.dayValue! < kept.dayValue!) && accept(segment.entry)) {
					byEntry.set(segment.entry, segment)
				}
			}
		}
		const runDays = (segment: EntrySegment) => segment.runEnd.dayValue! - segment.dayValue!
		return [...byEntry.values()].sort((a, b) => a.dayValue === b.dayValue
			? runDays(b) - runDays(a)
			: a.dayValue! - b.dayValue!)
	}

	/** Lane ranking for month grid packing (multi-day first, then all-day, then timed). */
	static laneRank(entry: Entry): number {
		if (!entry.start || !entry.end) {
			return 3
		}
		if (entry.multiDay) {
			return 0
		}
		return entry.allDay ? 1 : 2
	}

	monthWeek(week: ReadonlyArray<DateTime>): MonthWeek {
		const weekStart = week[0]!
		const weekEnd = week[week.length - 1]!
		const weekEndValue = weekEnd.dayStart.valueOf()
		const columnByDay = new Map(week.map((day, index) => [day.dayStart.valueOf(), index]))
		const columnOf = (dayValue: number) => columnByDay.get(dayValue) ?? -1

		const bars = new Array<MonthBar>()
		for (const segment of this.runsIn(weekStart, weekEnd, () => true)) {
			const startColumn = columnOf(segment.dayValue!)
			const clippedRight = segment.runEnd.dayValue! > weekEndValue
			const endColumn = clippedRight ? week.length - 1 : columnOf(segment.runEnd.dayValue!)
			if (startColumn < 0 || endColumn < 0) {
				continue
			}
			bars.push({ segment, startColumn, span: endColumn - startColumn + 1, slot: this.monthSlots.get(segment.entry) ?? 0, clippedRight })
		}
		return { bars }
	}

	private _monthSlots?: ReadonlyMap<Entry, number>
	get monthSlots(): ReadonlyMap<Entry, number> {
		return this._monthSlots ??= this.slots(this.entries)
	}

	/** The week all-day lane's packing: the same greedy rows over only the all-day entries — a timed
	 * entry never occupies a lane there, so packing around it would punch holes in the strip. Computed
	 * (not CSS `dense` auto-flow) because the lane needs its row COUNT for explicit tracks — see the
	 * `.all-day` rule in Days.ts for why auto-flow rows can't size that row. */
	private _allDaySlots?: ReadonlyMap<Entry, number>
	get allDaySlots(): ReadonlyMap<Entry, number> {
		return this._allDaySlots ??= this.slots(this.entries.filter(entry => !!entry.allDay))
	}

	private slots(entries: ReadonlyArray<Entry>): ReadonlyMap<Entry, number> {
		const datesByEntry = new Map<Entry, ReadonlyArray<number>>()
		const previewDates = new Map<Entry, ReadonlyArray<number>>()
		for (const entry of entries) {
			const dates = EntrySegments.for(entry).map(s => s.dayValue).filter((v): v is number => v !== undefined)
			if (!dates.length) {
				continue
			}
			(EntryStore.isPreview(entry) ? previewDates : datesByEntry).set(entry, dates)
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

		const source = EntryStore.dragSource
		const vacatingSlot = source ? slots.get(source) : undefined
		const vacating = new Set(source ? datesByEntry.get(source) ?? [] : [])
		for (const [preview, dates] of previewDates) {
			const index = rows.findIndex((row, slot) => dates.every(date => !row.has(date) || (slot === vacatingSlot && vacating.has(date))))
			slots.set(preview, index === -1 ? rows.length : index)
		}
		return slots
	}

	static readonly overlayHeadroomMinutes = 45
	static readonly overlayCascadeGapMinutes = 30
	private static readonly maxInset = 4

	/**
	 * Clusters timed segments into side-by-side columns and overlapping cascade tiers.
	 */
	private static cluster(segments: ReadonlyArray<EntrySegment>): ReadonlyArray<EntrySegment> {
		const chips = [...segments].sort((a, b) => a.startMinute !== b.startMinute
			? a.startMinute - b.startMinute
			: (b.endMinute - b.startMinute) - (a.endMinute - a.startMinute))

		interface Row { readonly segment: EntrySegment, readonly level: number, readonly host: EntrySegment }
		interface Group { readonly mates: Array<EntrySegment>, readonly rows: Array<Row>, end: number }
		const groups = new Array<Group>()
		const rows = new Array<Row>()
		let group: Group | undefined
		for (const segment of chips) {
			if (!group || segment.startMinute >= group.end) {
				group = { mates: [segment], rows: [], end: segment.endMinute }
				groups.push(group)
				continue
			}
			const hosts = group.mates.filter(mate => mate.endMinute > segment.startMinute
				&& mate.startMinute + EntrySegments.overlayHeadroomMinutes <= segment.startMinute)
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
				for (const row of g.rows) {
					row.segment.overlap = { ...row.host.overlap!, inset: Math.min(row.level, EntrySegments.maxInset) }
				}
			}
		}

		chips.forEach((chip, index) => {
			chip.covers = chips.slice(0, index).some(other => other.overlaps(chip) && EntrySegments.intersectsInline(other, chip))
		})

		return chips
	}

	private static intersectsInline(a: EntrySegment, b: EntrySegment): boolean {
		const aOverlap = a.overlap!
		const bOverlap = b.overlap!
		return Math.max(aOverlap.slot / aOverlap.total, bOverlap.slot / bOverlap.total)
			< Math.min((aOverlap.slot + aOverlap.span) / aOverlap.total, (bOverlap.slot + bOverlap.span) / bOverlap.total)
	}

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
