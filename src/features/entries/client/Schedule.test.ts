import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Schedule } from './Schedule.js'

describe('Schedule', () => {
	const day = new DateTime().dayStart
	const at = (d: number, hour: number, minute = 0) => day.add({ days: d }).with({ hour, minute })

	describe('timed', () => {
		it('orders a forward span as-is', () => {
			const { start, end } = Schedule.timed(at(0, 9), at(0, 10), 15)
			assert.equal(start.valueOf(), at(0, 9).valueOf())
			assert.equal(end.valueOf(), at(0, 10).valueOf())
		})

		it('flips a reversed span (start dragged after end)', () => {
			const { start, end } = Schedule.timed(at(0, 14), at(0, 9), 15)
			assert.equal(start.valueOf(), at(0, 9).valueOf())
			assert.equal(end.valueOf(), at(0, 14).valueOf())
		})

		it('enforces a minimum duration when the two points collapse', () => {
			const { start, end } = Schedule.timed(at(0, 9), at(0, 9), 15)
			assert.equal(start.valueOf(), at(0, 9).valueOf())
			assert.equal(end.valueOf(), at(0, 9, 15).valueOf())
		})
	})

	describe('allDay', () => {
		it('spans to the exclusive next midnight after the later day', () => {
			const { start, end } = Schedule.allDay(day, day.add({ days: 2 }))
			assert.equal(start.valueOf(), day.valueOf())
			assert.equal(end.valueOf(), day.add({ days: 3 }).valueOf())
		})

		it('flips when the earlier day is dragged after the later', () => {
			const { start, end } = Schedule.allDay(day.add({ days: 4 }), day.add({ days: 1 }))
			assert.equal(start.valueOf(), day.add({ days: 1 }).valueOf())
			assert.equal(end.valueOf(), day.add({ days: 5 }).valueOf())
		})
	})

	describe('resized (all-day, exclusive-end off-by-one)', () => {
		const allDay3 = { start: day, end: day.add({ days: 3 }), allDay: true }

		it('resize-start back onto its own first day leaves start and end unchanged', () => {
			const { start, end } = Schedule.resized(allDay3, 'start', day, 15)
			assert.equal(start.valueOf(), day.valueOf())
			assert.equal(end.valueOf(), day.add({ days: 3 }).valueOf())
		})

		it('resize-start later shrinks the leading edge, keeping the end', () => {
			const { start, end } = Schedule.resized(allDay3, 'start', day.add({ days: 1 }), 15)
			assert.equal(start.valueOf(), day.add({ days: 1 }).valueOf())
			assert.equal(end.valueOf(), day.add({ days: 3 }).valueOf())
		})

		it('resize-end extends the trailing edge, keeping the start', () => {
			const { start, end } = Schedule.resized(allDay3, 'end', day.add({ days: 5 }), 15)
			assert.equal(start.valueOf(), day.valueOf())
			assert.equal(end.valueOf(), day.add({ days: 6 }).valueOf())
		})

		it('resize-start dragged past the fixed last day flips the entry', () => {
			const { start, end } = Schedule.resized(allDay3, 'start', day.add({ days: 5 }), 15)
			assert.equal(start.valueOf(), day.add({ days: 2 }).valueOf())
			assert.equal(end.valueOf(), day.add({ days: 6 }).valueOf())
		})
	})

	describe('resized (timed)', () => {
		const timed = { start: at(0, 9), end: at(0, 10), allDay: false }

		it('resize-end across midnight into the next day', () => {
			const { start, end } = Schedule.resized(timed, 'end', at(1, 11), 15)
			assert.equal(start.valueOf(), at(0, 9).valueOf())
			assert.equal(end.valueOf(), at(1, 11).valueOf())
		})

		it('resize-end dragged before the start flips around the fixed start', () => {
			const { start, end } = Schedule.resized(timed, 'end', at(0, 8), 15)
			assert.equal(start.valueOf(), at(0, 8).valueOf())
			assert.equal(end.valueOf(), at(0, 9).valueOf())
		})
	})

	describe('movedBy', () => {
		it('lands the start on the nearest 15-minute line, keeping the length', () => {
			const meeting = new Schedule(at(0, 9), at(0, 10))
			const minute = 60_000
			assert.equal(meeting.movedBy(7 * minute, 15).start.valueOf(), at(0, 9).valueOf())
			const moved = meeting.movedBy(8 * minute, 15)
			assert.equal(moved.start.valueOf(), at(0, 9, 15).valueOf())
			assert.equal(moved.end!.valueOf(), at(0, 10, 15).valueOf())
		})

		it('moves a moment, which has no end', () => {
			const moment = new Schedule(at(0, 9), undefined).movedBy(60 * 60_000, 15)
			assert.equal(moment.start.valueOf(), at(0, 10).valueOf())
			assert.equal(moment.end, undefined)
		})
	})
})
