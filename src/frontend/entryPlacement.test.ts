import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { placeAllDay, placeTimed, resizePlacement, snapToGrid } from './entryPlacement.js'

describe('entryPlacement', () => {
	const day = new DateTime().dayStart
	const at = (d: number, hour: number, minute = 0) => day.add({ days: d }).with({ hour, minute })

	describe('placeTimed', () => {
		it('orders a forward span as-is', () => {
			const { start, end } = placeTimed(at(0, 9), at(0, 10))
			assert.equal(start.valueOf(), at(0, 9).valueOf())
			assert.equal(end.valueOf(), at(0, 10).valueOf())
		})

		it('flips a reversed span (start dragged after end)', () => {
			const { start, end } = placeTimed(at(0, 14), at(0, 9))
			assert.equal(start.valueOf(), at(0, 9).valueOf())
			assert.equal(end.valueOf(), at(0, 14).valueOf())
		})

		it('enforces a minimum duration when the two points collapse', () => {
			const { start, end } = placeTimed(at(0, 9), at(0, 9))
			assert.equal(start.valueOf(), at(0, 9).valueOf())
			assert.equal(end.valueOf(), at(0, 9, 15).valueOf())
		})
	})

	describe('placeAllDay', () => {
		it('spans to the exclusive next midnight after the later day', () => {
			const { start, end } = placeAllDay(day, day.add({ days: 2 }))
			assert.equal(start.valueOf(), day.valueOf())
			assert.equal(end.valueOf(), day.add({ days: 3 }).valueOf()) // exclusive end = lastDay + 1
		})

		it('flips when the earlier day is dragged after the later', () => {
			const { start, end } = placeAllDay(day.add({ days: 4 }), day.add({ days: 1 }))
			assert.equal(start.valueOf(), day.add({ days: 1 }).valueOf())
			assert.equal(end.valueOf(), day.add({ days: 5 }).valueOf())
		})
	})

	describe('resizePlacement (all-day, exclusive-end off-by-one)', () => {
		// A 3-day all-day entry: days 0,1,2 inclusive → start = day0, end = day3 (exclusive next midnight).
		const allDay3 = { start: day, end: day.add({ days: 3 }), allDay: true }

		it('resize-start back onto its own first day leaves start and end unchanged', () => {
			const { start, end } = resizePlacement(allDay3, 'start', day)
			assert.equal(start.valueOf(), day.valueOf())
			assert.equal(end.valueOf(), day.add({ days: 3 }).valueOf()) // must NOT grow by a day
		})

		it('resize-start later shrinks the leading edge, keeping the end', () => {
			const { start, end } = resizePlacement(allDay3, 'start', day.add({ days: 1 }))
			assert.equal(start.valueOf(), day.add({ days: 1 }).valueOf())
			assert.equal(end.valueOf(), day.add({ days: 3 }).valueOf())
		})

		it('resize-end extends the trailing edge, keeping the start', () => {
			const { start, end } = resizePlacement(allDay3, 'end', day.add({ days: 5 }))
			assert.equal(start.valueOf(), day.valueOf())
			assert.equal(end.valueOf(), day.add({ days: 6 }).valueOf())
		})

		it('resize-start dragged past the fixed last day flips the entry', () => {
			const { start, end } = resizePlacement(allDay3, 'start', day.add({ days: 5 }))
			// fixed last inclusive day = day2; dragged day5 is later → span day2..day5
			assert.equal(start.valueOf(), day.add({ days: 2 }).valueOf())
			assert.equal(end.valueOf(), day.add({ days: 6 }).valueOf())
		})
	})

	describe('resizePlacement (timed)', () => {
		const timed = { start: at(0, 9), end: at(0, 10), allDay: false }

		it('resize-end across midnight into the next day', () => {
			const { start, end } = resizePlacement(timed, 'end', at(1, 11))
			assert.equal(start.valueOf(), at(0, 9).valueOf())
			assert.equal(end.valueOf(), at(1, 11).valueOf())
		})

		it('resize-end dragged before the start flips around the fixed start', () => {
			const { start, end } = resizePlacement(timed, 'end', at(0, 8))
			assert.equal(start.valueOf(), at(0, 8).valueOf())
			assert.equal(end.valueOf(), at(0, 9).valueOf())
		})
	})

	describe('snapToGrid', () => {
		it('rounds an instant to the nearest 15-minute boundary', () => {
			assert.equal(snapToGrid(at(0, 9, 7).valueOf()), at(0, 9).valueOf())
			assert.equal(snapToGrid(at(0, 9, 8).valueOf()), at(0, 9, 15).valueOf())
		})
	})
})
