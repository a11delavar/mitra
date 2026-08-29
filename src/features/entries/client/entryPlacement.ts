import type { DateTime } from '@3mo/date-time'
import { type Entry } from '../Entry.js'

export interface Span {
	readonly start: DateTime
	readonly end: DateTime
}

/** Order two days into an all-day span `[from, exclusive next midnight after to]`. */
export function placeAllDay(a: DateTime, b: DateTime): Span {
	const [from, to] = a.dayStart.isAfter(b.dayStart) ? [b, a] : [a, b]
	return { start: from.dayStart, end: to.dayStart.add({ days: 1 }) }
}

/** Order two instants into a timed span, flipping if reversed and enforcing a minimum duration. */
export function placeTimed(a: DateTime, b: DateTime, snapMinutes: number): Span {
	// eslint-disable-next-line prefer-const
	let [start, end] = a.valueOf() <= b.valueOf() ? [a, b] : [b, a]
	if (end.valueOf() <= start.valueOf()) {
		end = start.add({ minutes: snapMinutes })
	}
	return { start, end }
}

/** Computes the new span when resizing one edge of an existing entry to `dragged`. */
export function resizePlacement(entry: Pick<Entry, 'start' | 'end' | 'allDay'>, edge: 'start' | 'end', dragged: DateTime, snapMinutes: number): Span {
	if (entry.allDay) {
		const firstDay = entry.start!.dayStart
		const lastDay = entry.end!.dayStart.subtract({ days: 1 })
		return placeAllDay(edge === 'end' ? firstDay : lastDay, dragged)
	}
	return placeTimed(edge === 'end' ? entry.start! : entry.end!, dragged, snapMinutes)
}

/** Round an epoch-ms instant onto the nearest `snapMinutes` grid line. */
export function snapToGrid(ms: number, snapMinutes: number): number {
	const step = snapMinutes * 60_000
	return Math.round(ms / step) * step
}
