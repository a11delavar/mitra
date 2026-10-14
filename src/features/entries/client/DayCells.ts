import type { DateTime } from '@3mo/date-time'

/** A day of a grid as laid out on screen when a drag begins. */
export interface DayCell {
	readonly date: DateTime
	readonly left: number
	readonly right: number
	readonly top: number
	readonly bottom: number
	readonly gridTop: number
	readonly gridHeight: number
}

/** The days a drag can land on. */
export class DayCells {
	constructor(private readonly cells: ReadonlyArray<DayCell>) { }

	get isEmpty() {
		return !this.cells.length
	}

	/** The day under the point, else the nearest: days sit a hairline apart, and a point on the line between two belongs to one of them. */
	nearest(x: number, y: number): DayCell | undefined {
		let nearest: DayCell | undefined
		let nearestDistance = Infinity
		for (const cell of this.cells) {
			const dx = x < cell.left ? cell.left - x : x > cell.right ? x - cell.right : 0
			const dy = y < cell.top ? cell.top - y : y > cell.bottom ? y - cell.bottom : 0
			const distance = dx * dx + dy * dy
			if (distance < nearestDistance) {
				nearestDistance = distance
				nearest = cell
			}
		}
		return nearest
	}
}
