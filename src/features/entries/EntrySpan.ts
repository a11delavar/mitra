import type { DateTime } from '@3mo/date-time'

/**
 * Where an entry lies, apart from the entry: its schedule (`start`, `end`, `allDay`) and the constraints standing beside it
 * (`estimate`, `due`). An entry hands one out (`entry.span`) and takes one back (`entry.adopt(span)`), so a gesture, a copy
 * or a preview moves the span alone; an all-day one ends at the midnight after its last day, and a moment has no end.
 */
export class EntrySpan {
	/** The days from one to the other, in either order. */
	static allDay(a: DateTime, b: DateTime) {
		const [from, to] = a.dayStart.isAfter(b.dayStart) ? [b, a] : [a, b]
		return new EntrySpan({ start: from.dayStart, end: to.dayStart.add({ days: 1 }), allDay: true })
	}

	/** The instants from one to the other, in either order, lasting at least `minimumMinutes`. */
	static timed(a: DateTime, b: DateTime, minimumMinutes: number) {
		const [start, end] = a.valueOf() <= b.valueOf() ? [a, b] : [b, a]
		return new EntrySpan({ start, end: end.valueOf() > start.valueOf() ? end : start.add({ minutes: minimumMinutes }), allDay: false })
	}

	readonly start?: DateTime
	readonly end?: DateTime
	readonly allDay: boolean
	readonly estimate?: number
	readonly due?: DateTime

	constructor(init: { readonly start?: DateTime, readonly end?: DateTime, readonly allDay?: boolean, readonly estimate?: number, readonly due?: DateTime }) {
		this.start = init.start
		this.end = init.end
		this.allDay = !!init.allDay
		this.estimate = init.estimate
		this.due = init.due
	}

	/** Whether the two lie on the same dates: both ends and the precision, so two undated spans are one. */
	equals(other: EntrySpan) {
		return this.allDay === other.allDay
			&& this.start?.valueOf() === other.start?.valueOf()
			&& this.end?.valueOf() === other.end?.valueOf()
	}

	/** Moved by `milliseconds`, its start landing on the nearest `snapMinutes` line; a moment stays one. */
	movedBy(milliseconds: number, snapMinutes: number) {
		const start = this.start!
		const step = snapMinutes * 60_000
		const shift = Math.round((start.valueOf() + milliseconds) / step) * step - start.valueOf()
		return new EntrySpan({ ...this, start: start.add({ milliseconds: shift }), end: this.end?.add({ milliseconds: shift }) })
	}

	/** With one edge dragged to `dragged`, which may cross the other. */
	resized(edge: 'start' | 'end', dragged: DateTime, minimumMinutes: number) {
		const resized = this.allDay
			? EntrySpan.allDay(edge === 'end' ? this.start!.dayStart : this.end!.dayStart.subtract({ days: 1 }), dragged)
			: EntrySpan.timed(edge === 'end' ? this.start! : this.end!, dragged, minimumMinutes)
		return new EntrySpan({ ...this, start: resized.start, end: resized.end })
	}
}
