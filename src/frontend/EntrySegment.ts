import type { DateTime } from '@3mo/date-time'
import type { Entry } from 'shared'

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

	get startMinute() {
		return this.previous ? 1 : this.entry.start ? this.entry.start.hour * 60 + this.entry.start.minute + 1 : 1
	}

	get endMinute() {
		return this.next ? 1441 : this.entry.end ? this.entry.end.hour * 60 + this.entry.end.minute + 1 : 2
	}

	get allDay() {
		return !!this.previous || !!this.next || !!this.entry.allDay
	}

	get runEnd(): EntrySegment {
		return this.next?.runEnd ?? this
	}

	get id() {
		return `${this.entry.id}-${this.date?.dayStart.valueOf() ?? 0}`
	}

	fallsOnDay(date: DateTime) {
		const dayStart = date.dayStart
		if (this.date) {
			return this.date.dayStart.equals(dayStart)
		}
		const start = this.entry.start
		return !!start && !start.isBefore(dayStart) && start.isBefore(dayStart.add({ days: 1 }))
	}

	/** Whether this segment overlaps another in time — drives the same-day side-by-side clustering. */
	overlaps(other: EntrySegment) {
		return Math.max(this.startMinute, other.startMinute) < Math.min(this.endMinute, other.endMinute)
	}
}
