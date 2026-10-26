import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { EntrySpan } from './EntrySpan.js'

describe('EntrySpan', () => {
	const day = new DateTime().dayStart
	const at = (d: number, hour: number, minute = 0) => day.add({ days: d }).with({ hour, minute })

	describe('timed', () => {
		it('orders a forward span as-is', () => {
			const { start, end, allDay } = EntrySpan.timed(at(0, 9), at(0, 10), 15)
			assert.deepEqual([start!.valueOf(), end!.valueOf(), allDay], [at(0, 9).valueOf(), at(0, 10).valueOf(), false])
		})

		it('flips a reversed span (start dragged after end)', () => {
			const { start, end } = EntrySpan.timed(at(0, 14), at(0, 9), 15)
			assert.equal(start!.valueOf(), at(0, 9).valueOf())
			assert.equal(end!.valueOf(), at(0, 14).valueOf())
		})

		it('enforces a minimum duration when the two points collapse', () => {
			const { start, end } = EntrySpan.timed(at(0, 9), at(0, 9), 15)
			assert.equal(start!.valueOf(), at(0, 9).valueOf())
			assert.equal(end!.valueOf(), at(0, 9, 15).valueOf())
		})
	})

	describe('allDay', () => {
		it('spans to the exclusive next midnight after the later day', () => {
			const { start, end, allDay } = EntrySpan.allDay(day, day.add({ days: 2 }))
			assert.deepEqual([start!.valueOf(), end!.valueOf(), allDay], [day.valueOf(), day.add({ days: 3 }).valueOf(), true])
		})

		it('flips when the earlier day is dragged after the later', () => {
			const { start, end } = EntrySpan.allDay(day.add({ days: 4 }), day.add({ days: 1 }))
			assert.equal(start!.valueOf(), day.add({ days: 1 }).valueOf())
			assert.equal(end!.valueOf(), day.add({ days: 5 }).valueOf())
		})
	})

	describe('resized (all-day, exclusive-end off-by-one)', () => {
		const allDay3 = new EntrySpan({ start: day, end: day.add({ days: 3 }), allDay: true })

		it('resize-start back onto its own first day leaves start and end unchanged', () => {
			const { start, end } = allDay3.resized('start', day, 15)
			assert.equal(start!.valueOf(), day.valueOf())
			assert.equal(end!.valueOf(), day.add({ days: 3 }).valueOf())
		})

		it('resize-start later shrinks the leading edge, keeping the end', () => {
			const { start, end } = allDay3.resized('start', day.add({ days: 1 }), 15)
			assert.equal(start!.valueOf(), day.add({ days: 1 }).valueOf())
			assert.equal(end!.valueOf(), day.add({ days: 3 }).valueOf())
		})

		it('resize-end extends the trailing edge, keeping the start', () => {
			const { start, end } = allDay3.resized('end', day.add({ days: 5 }), 15)
			assert.equal(start!.valueOf(), day.valueOf())
			assert.equal(end!.valueOf(), day.add({ days: 6 }).valueOf())
		})

		it('resize-start dragged past the fixed last day flips the entry', () => {
			const { start, end } = allDay3.resized('start', day.add({ days: 5 }), 15)
			assert.equal(start!.valueOf(), day.add({ days: 2 }).valueOf())
			assert.equal(end!.valueOf(), day.add({ days: 6 }).valueOf())
		})
	})

	describe('resized (timed)', () => {
		const timed = new EntrySpan({ start: at(0, 9), end: at(0, 10) })

		it('resize-end across midnight into the next day', () => {
			const { start, end } = timed.resized('end', at(1, 11), 15)
			assert.equal(start!.valueOf(), at(0, 9).valueOf())
			assert.equal(end!.valueOf(), at(1, 11).valueOf())
		})

		it('resize-end dragged before the start flips around the fixed start', () => {
			const { start, end } = timed.resized('end', at(0, 8), 15)
			assert.equal(start!.valueOf(), at(0, 8).valueOf())
			assert.equal(end!.valueOf(), at(0, 9).valueOf())
		})
	})

	describe('movedBy', () => {
		it('lands the start on the nearest 15-minute line, keeping the length', () => {
			const meeting = new EntrySpan({ start: at(0, 9), end: at(0, 10) })
			const minute = 60_000
			assert.equal(meeting.movedBy(7 * minute, 15).start!.valueOf(), at(0, 9).valueOf())
			const moved = meeting.movedBy(8 * minute, 15)
			assert.equal(moved.start!.valueOf(), at(0, 9, 15).valueOf())
			assert.equal(moved.end!.valueOf(), at(0, 10, 15).valueOf())
		})

		it('moves a moment, which has no end, and keeps what stands beside it', () => {
			const moment = new EntrySpan({ start: at(0, 9), due: at(2, 17) }).movedBy(60 * 60_000, 15)
			assert.equal(moment.start!.valueOf(), at(0, 10).valueOf())
			assert.equal(moment.end, undefined)
			assert.equal(moment.due!.valueOf(), at(2, 17).valueOf())
		})
	})

	describe('equals', () => {
		it('is true only when both ends and the all-day flag match', () => {
			const span = new EntrySpan({ start: at(0, 9), end: at(0, 10) })
			assert.equal(span.equals(new EntrySpan({ start: at(0, 9), end: at(0, 10) })), true)
			assert.equal(span.equals(new EntrySpan({ start: at(0, 9), end: at(0, 11) })), false)
			assert.equal(span.equals(new EntrySpan({ start: at(0, 9), end: at(0, 10), allDay: true })), false)
		})

		it('treats two undated spans as the same', () => {
			assert.equal(new EntrySpan({}).equals(new EntrySpan({})), true)
			assert.equal(new EntrySpan({}).equals(new EntrySpan({ start: day })), false)
		})
	})
})
