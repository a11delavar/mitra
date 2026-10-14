import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { DayCells, type DayCell } from './DayCells.js'

describe('DayCells', () => {
	/** Days 100 wide, a hairline apart, in rows of `perRow` 50 high, a hairline apart too. */
	const laidOut = (count: number, perRow = count) => Array.from({ length: count }, (_, index): DayCell => {
		const left = (index % perRow) * 101
		const top = Math.floor(index / perRow) * 51
		return { date: new DateTime(Date.UTC(2026, 9, 12 + index)), left, right: left + 100, top, bottom: top + 50, gridTop: top, gridHeight: 50 }
	})
	const dayAt = (cells: DayCells, x: number, y: number) => cells.nearest(x, y)?.date.getUTCDate()

	describe('in columns (week, timeline)', () => {
		const week = new DayCells(laidOut(70))

		it('picks the day under the point', () => {
			assert.equal(dayAt(week, 150, 20), 13)
		})

		it('keeps a point on the line between two days on one of them, never the last day of the buffer', () => {
			assert.equal(dayAt(week, 100.5, 20), 12)
			assert.equal(dayAt(week, 100.75, 20), 13)
		})

		it('picks by the inline position above and below the grid, clamping to the first and last day', () => {
			assert.equal(dayAt(week, 150, 900), 13)
			assert.equal(dayAt(week, -40, 20), 12)
			assert.equal(dayAt(week, 99_999, 20), laidOut(70).at(-1)!.date.getUTCDate())
		})
	})

	describe('in rows (month)', () => {
		const month = new DayCells(laidOut(14, 7))

		it('picks the day under the point, else the nearest across both axes', () => {
			assert.equal(dayAt(month, 150, 70), 20)
			assert.equal(dayAt(month, 150, 50.25), 13)
			assert.equal(dayAt(month, 150, 50.75), 20)
			assert.equal(dayAt(month, 150, 999), 20)
		})
	})

	it('has no day to pick when empty', () => {
		const none = new DayCells([])
		assert.equal(none.isEmpty, true)
		assert.equal(none.nearest(0, 0), undefined)
		assert.equal(new DayCells(laidOut(1)).isEmpty, false)
	})
})
