import type { DateTime } from '@3mo/date-time'
import type { Entry } from 'shared'
import { EntryStore } from './EntryStore.js'

/** Side-by-side placement among timed events sharing a day — the one datum CSS grid can't derive,
 * because each box's fractional width depends on the local cluster size. Filled in by `EntrySegments`. */
export interface TimedOverlap {
	readonly slot: number
	readonly total: number
	readonly span: number
}

/**
 * One entry projected onto a single day — the atom every view renders. It stores only what can't be
 * inferred: the entry, the day, and links to the adjacent days of the same run. Everything positional
 * (minutes, spans, continuation edges) is derived from those, so views can self-place each segment on
 * a CSS grid by its own date. The sole exception is `overlap` (see above), which the cohort fills in.
 */
export class EntrySegment {
	previous?: EntrySegment
	next?: EntrySegment
	overlap?: TimedOverlap

	constructor(readonly entry: Entry, readonly date?: DateTime) { }

	get hasPrevious() { return !!this.previous }
	get hasNext() { return !!this.next }

	// Cached numeric projections. Every `@3mo/date-time` field/`dayStart` accessor rebuilds a Temporal
	// object, so we derive these once. Segments are memoised globally by `EntrySegments.for`, so the cost
	// is paid once per segment — then same-day checks and clustering are pure integer math each render.
	private _startMinute?: number
	get startMinute() {
		return this._startMinute ??= this.previous ? 1 : this.entry.start ? this.entry.start.hour * 60 + this.entry.start.minute + 1 : 1
	}

	private _endMinute?: number
	get endMinute() {
		return this._endMinute ??= this.next ? 1441 : this.entry.end ? this.entry.end.hour * 60 + this.entry.end.minute + 1 : 2
	}

	/** Epoch-ms of this segment's day (midnight), or `undefined` when undated — the cheap key for every
	 * same-day comparison. Compare these numbers instead of constructing `dayStart` repeatedly. */
	private _dayValue?: number
	get dayValue(): number | undefined {
		return this._dayValue ??= this.date?.dayStart.valueOf()
	}

	get allDay() {
		return !!this.previous || !!this.next || !!this.entry.allDay
	}

	get runEnd(): EntrySegment {
		return this.next?.runEnd ?? this
	}

	get id() {
		// An id-less entry is one of exactly two local things — the create draft or a move's ghost —
		// and only ever one of each exists, so naming the kind is all the disambiguation keyed renders
		// (and DOM anchor/transition names) need.
		return `${this.entry.id ?? (EntryStore.isPreview(this.entry) ? 'preview' : 'draft')}-${this.dayValue ?? 0}`
	}

	/** Whether this segment renders on the day identified by `dayValue` (epoch-ms of its midnight). */
	fallsOn(dayValue: number) {
		return this.date ? this.dayValue === dayValue : this.entry.start?.dayStart.valueOf() === dayValue
	}

	fallsOnDay(date: DateTime) {
		return this.fallsOn(date.dayStart.valueOf())
	}

	/** Whether this segment overlaps another in time — drives the same-day side-by-side clustering. */
	overlaps(other: EntrySegment) {
		return Math.max(this.startMinute, other.startMinute) < Math.min(this.endMinute, other.endMinute)
	}
}
