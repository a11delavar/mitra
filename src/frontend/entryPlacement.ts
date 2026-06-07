import type { DateTime } from '@3mo/date-time'
import { type Entry, SNAP_MINUTES } from 'shared'

export interface Span {
	readonly start: DateTime
	readonly end: DateTime
}

/** Order two days into an all-day span — `[from, exclusive next midnight after to]`. Dragging the two days
 * past each other just swaps them, so a create/resize gesture flips gracefully with no special case. */
export function placeAllDay(a: DateTime, b: DateTime): Span {
	const [from, to] = a.dayStart.isAfter(b.dayStart) ? [b, a] : [a, b]
	return { start: from.dayStart, end: to.dayStart.add({ days: 1 }) }
}

/** Order two instants into a timed span, flipping if reversed and enforcing a minimum duration. */
export function placeTimed(a: DateTime, b: DateTime, snapMinutes = SNAP_MINUTES): Span {
	// eslint-disable-next-line prefer-const
	let [start, end] = a.valueOf() <= b.valueOf() ? [a, b] : [b, a]
	if (end.valueOf() <= start.valueOf()) {
		end = start.add({ minutes: snapMinutes })
	}
	return { start, end }
}

/** The new span when resizing one edge of an existing entry to `dragged`, keeping the other edge fixed.
 * All-day bounds are exclusive next-midnight, so the fixed *trailing* edge is `end − 1 day`; dragging an
 * edge past the other flips the entry, matching the create gesture. */
export function resizePlacement(entry: Pick<Entry, 'start' | 'end' | 'allDay'>, edge: 'start' | 'end', dragged: DateTime, snapMinutes = SNAP_MINUTES): Span {
	if (entry.allDay) {
		const firstDay = entry.start!.dayStart
		const lastDay = entry.end!.dayStart.subtract({ days: 1 }) // end is the exclusive next midnight
		return placeAllDay(edge === 'end' ? firstDay : lastDay, dragged)
	}
	return placeTimed(edge === 'end' ? entry.start! : entry.end!, dragged, snapMinutes)
}

/** Round an epoch-ms instant onto the nearest `snapMinutes` grid line. 15-minute boundaries align with
 * every standard timezone's local grid (UTC offsets are whole multiples of 15 minutes). */
export function snapToGrid(ms: number, snapMinutes = SNAP_MINUTES): number {
	const step = snapMinutes * 60_000
	return Math.round(ms / step) * step
}
