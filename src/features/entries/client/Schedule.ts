import type { DateTime } from '@3mo/date-time'
import { type Entry } from '../Entry.js'

/** Where a drag places an entry: its start and end, an all-day one ending at the midnight after its last day. */
export class Schedule<End extends DateTime | undefined = DateTime> {
	/** The days from one to the other, in either order. */
	static allDay(a: DateTime, b: DateTime): Schedule {
		const [from, to] = a.dayStart.isAfter(b.dayStart) ? [b, a] : [a, b]
		return new Schedule(from.dayStart, to.dayStart.add({ days: 1 }))
	}

	/** The instants from one to the other, in either order, lasting at least `minimumMinutes`. */
	static timed(a: DateTime, b: DateTime, minimumMinutes: number): Schedule {
		const [start, end] = a.valueOf() <= b.valueOf() ? [a, b] : [b, a]
		return new Schedule(start, end.valueOf() > start.valueOf() ? end : start.add({ minutes: minimumMinutes }))
	}

	/** `entry`'s schedule with one edge dragged to `dragged`, which may cross the other. */
	static resized(entry: Pick<Entry, 'start' | 'end' | 'allDay'>, edge: 'start' | 'end', dragged: DateTime, minimumMinutes: number): Schedule {
		if (entry.allDay) {
			const firstDay = entry.start!.dayStart
			const lastDay = entry.end!.dayStart.subtract({ days: 1 })
			return Schedule.allDay(edge === 'end' ? firstDay : lastDay, dragged)
		}
		return Schedule.timed(edge === 'end' ? entry.start! : entry.end!, dragged, minimumMinutes)
	}

	/** `End` is undefined for a moment, which has no end. */
	constructor(readonly start: DateTime, readonly end: End) { }

	/** Moved by `milliseconds`, its start landing on the nearest `snapMinutes` line. */
	movedBy(milliseconds: number, snapMinutes: number): Schedule<End> {
		const step = snapMinutes * 60_000
		const shift = Math.round((this.start.valueOf() + milliseconds) / step) * step - this.start.valueOf()
		return new Schedule(this.start.add({ milliseconds: shift }), this.end?.add({ milliseconds: shift }) as End)
	}
}
