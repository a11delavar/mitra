import { type DateTime } from '@3mo/date-time'
import { type EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
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
	private static readonly perOccurrence = new WeakMap<EntryOccurrence, { readonly spanKey: string, readonly segments: ReadonlyArray<EntrySegment> }>()

	private static spanKey(occurrence: EntryOccurrence) {
		return `${occurrence.start?.valueOf()}:${occurrence.end?.valueOf()}:${occurrence.allDay}`
	}

	/** Returns memoized per-day slices for an occurrence. */
	static for(occurrence: EntryOccurrence): ReadonlyArray<EntrySegment> {
		const spanKey = EntrySegments.spanKey(occurrence)
		let memo = EntrySegments.perOccurrence.get(occurrence)
		if (memo?.spanKey !== spanKey) {
			memo = { spanKey, segments: EntrySegments.slice(occurrence) }
			EntrySegments.perOccurrence.set(occurrence, memo)
		}
		return memo.segments
	}

	private static slice(occurrence: EntryOccurrence): ReadonlyArray<EntrySegment> {
		const { start, end } = occurrence
		if (!start) {
			return [new EntrySegment(occurrence)]
		}
		// A moment with no end still belongs to the day it starts on.
		if (!end) {
			return [new EntrySegment(occurrence, start.dayStart)]
		}
		const startDay = start.dayStart
		const endDay = end.dayStart
		if (startDay.equals(endDay) || (end.hour === 0 && end.minute === 0 && startDay.equals(endDay.subtract({ days: 1 })))) {
			return [new EntrySegment(occurrence, startDay)]
		}
		const segments = new Array<EntrySegment>()
		let day = startDay
		while (day.isBefore(endDay) || (day.equals(endDay) && (end.hour > 0 || end.minute > 0))) {
			const segment = new EntrySegment(occurrence, day)
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

	/** Returns cached or new EntrySegments cohort for given occurrences and days. */
	static of(occurrences: ReadonlyArray<EntryOccurrence>, days: ReadonlyArray<DateTime>): EntrySegments {
		const cached = EntrySegments.cache.get(days)
		if (cached?.occurrences === occurrences) {
			return cached
		}
		const cohort = new EntrySegments(occurrences, days, cached?.clustered)
		EntrySegments.cache.set(days, cohort)
		return cohort
	}

	constructor(
		readonly occurrences: ReadonlyArray<EntryOccurrence>,
		readonly days: ReadonlyArray<DateTime>,
		/** Each day's clustered list with the segments it was made of, handed on to the next cohort of these days. */
		private readonly clustered = new Map<number, { readonly members: ReadonlyArray<EntrySegment>, readonly list: ReadonlyArray<EntrySegment> }>(),
	) { }

	private _timedByDay?: ReadonlyMap<number, ReadonlyArray<EntrySegment>>
	private get timedByDay() {
		if (!this._timedByDay) {
			const byDay = new Map<number, Array<EntrySegment>>()
			for (const occurrence of this.occurrences) {
				if (!occurrence.allDay) {
					for (const segment of EntrySegments.for(occurrence)) {
						// The day `fallsOn` names: its own, else for a dateless slice its start.
						const day = segment.date ? segment.dayValue : occurrence.start?.dayStart.valueOf()
						if (day !== undefined) {
							const list = byDay.get(day)
							list ? list.push(segment) : byDay.set(day, [segment])
						}
					}
				}
			}
			this._timedByDay = byDay
		}
		return this._timedByDay
	}

	/**
	 * Clustered timed segments for the given day. A day made of the same segments as before gets its very list back, so a
	 * drag re-renders the days it crosses and no other.
	 */
	timedOn(date: DateTime): ReadonlyArray<EntrySegment> {
		const key = date.dayStart.valueOf()
		const members = this.timedByDay.get(key) ?? []
		const kept = this.clustered.get(key)
		if (kept && kept.members.length === members.length && kept.members.every((segment, index) => segment === members[index])) {
			return kept.list
		}
		// A preview is an entry of its own, so the same members are the same overlay too.
		const isOverlay = (segment: EntrySegment) => EntryStore.isPreview(segment.entry)
		const list = [...EntrySegments.cluster(members.filter(segment => !isOverlay(segment))), ...members.filter(isOverlay)]
		this.clustered.set(key, { members, list })
		return list
	}

	private _segmentsByDay?: ReadonlyMap<number, ReadonlyArray<EntrySegment>>
	private get segmentsByDay(): ReadonlyMap<number, ReadonlyArray<EntrySegment>> {
		if (!this._segmentsByDay) {
			const map = new Map<number, Array<EntrySegment>>()
			for (const occurrence of this.occurrences) {
				for (const segment of EntrySegments.for(occurrence)) {
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
	runsIn(from: DateTime, to: DateTime, accept: (occurrence: EntryOccurrence) => boolean): ReadonlyArray<EntrySegment> {
		const fromValue = from.dayStart.valueOf()
		const toValue = to.dayStart.valueOf()
		const byOccurrence = new Map<EntryOccurrence, EntrySegment>()
		for (const [dayValue, segments] of this.segmentsByDay) {
			if (dayValue < fromValue || dayValue > toValue) {
				continue
			}
			for (const segment of segments) {
				const kept = byOccurrence.get(segment.occurrence)
				if ((!kept || segment.dayValue! < kept.dayValue!) && accept(segment.occurrence)) {
					byOccurrence.set(segment.occurrence, segment)
				}
			}
		}
		const runDays = (segment: EntrySegment) => segment.runEnd.dayValue! - segment.dayValue!
		return [...byOccurrence.values()].sort((a, b) => a.dayValue === b.dayValue
			? runDays(b) - runDays(a)
			: a.dayValue! - b.dayValue!)
	}

	/** Lane ranking for month grid packing (multi-day first, then all-day, then timed). */
	static laneRank(occurrence: EntryOccurrence): number {
		if (!occurrence.start || !occurrence.end) {
			return 3
		}
		if (occurrence.multiDay) {
			return 0
		}
		return occurrence.allDay ? 1 : 2
	}

	/**
	 * The order lanes are packed in: by rank, then earliest start and longest first. Ties fall to the heading, so the order
	 * never depends on how the entries arrived and a reload never swaps two lanes.
	 */
	static laneOrder(a: EntryOccurrence, b: EntryOccurrence): number {
		const rank = EntrySegments.laneRank(a) - EntrySegments.laneRank(b)
		if (rank !== 0) return rank
		if (a.start && b.start && !a.start.equals(b.start)) return a.start.isBefore(b.start) ? -1 : 1
		if (a.end && b.end && !a.end.equals(b.end)) return a.end.isAfter(b.end) ? -1 : 1
		return a.entry.heading.localeCompare(b.entry.heading) || String(a.key).localeCompare(String(b.key))
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
			bars.push({ segment, startColumn, span: endColumn - startColumn + 1, slot: this.monthSlots.get(segment.occurrence) ?? 0, clippedRight })
		}
		return { bars }
	}

	private _monthSlots?: ReadonlyMap<EntryOccurrence, number>
	get monthSlots(): ReadonlyMap<EntryOccurrence, number> {
		return this._monthSlots ??= this.slots(this.occurrences)
	}

	/** The week all-day lane's packing: the same greedy rows over only the all-day entries. A timed
	 * entry never occupies a lane there, so packing around it would punch holes in the strip. Computed
	 * (not CSS `dense` auto-flow) because the lane needs its row COUNT for explicit tracks. See the
	 * `.all-day` rule in Days.ts for why auto-flow rows can't size that row. */
	private _allDaySlots?: ReadonlyMap<EntryOccurrence, number>
	get allDaySlots(): ReadonlyMap<EntryOccurrence, number> {
		return this._allDaySlots ??= this.slots(this.occurrences.filter(occurrence => occurrence.allDay))
	}

	private slots(occurrences: ReadonlyArray<EntryOccurrence>): ReadonlyMap<EntryOccurrence, number> {
		const datesByOccurrence = new Map<EntryOccurrence, ReadonlyArray<number>>()
		const previewDates = new Map<EntryOccurrence, ReadonlyArray<number>>()
		for (const occurrence of occurrences) {
			const dates = EntrySegments.for(occurrence).map(s => s.dayValue).filter((v): v is number => v !== undefined)
			if (!dates.length) {
				continue
			}
			(EntryStore.isPreview(occurrence.entry) ? previewDates : datesByOccurrence).set(occurrence, dates)
		}

		const ordered = [...datesByOccurrence.keys()].sort(EntrySegments.laneOrder)

		const slots = new Map<EntryOccurrence, number>()
		const rows = new Array<Set<number>>()
		for (const occurrence of ordered) {
			const dates = datesByOccurrence.get(occurrence)!
			let slot = rows.findIndex(row => dates.every(date => !row.has(date)))
			if (slot === -1) {
				slot = rows.length
				rows.push(new Set())
			}
			dates.forEach(date => rows[slot]!.add(date))
			slots.set(occurrence, slot)
		}

		const dragged = EntryStore.dragSource
		const source = dragged && ordered.find(occurrence => occurrence.entry === dragged)
		const vacatingSlot = source ? slots.get(source) : undefined
		const vacating = new Set(source ? datesByOccurrence.get(source) ?? [] : [])
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
