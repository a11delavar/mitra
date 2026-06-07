import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from './Entry.js'

describe('Entry', () => {
	const day = new DateTime().dayStart

	describe('multiDay', () => {
		it('is false within a single day', () => {
			assert.equal(new Entry({ start: day.add({ hours: 9 }), end: day.add({ hours: 17 }) }).multiDay, false)
		})

		it('is true across day boundaries', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 2 }) }).multiDay, true)
		})

		it('is false for a single all-day day (end is the exclusive next midnight)', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }), allDay: true }).multiDay, false)
		})

		it('is true for a multi-day all-day span', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 3 }), allDay: true }).multiDay, true)
		})

		it('is false when undated', () => {
			assert.equal(new Entry({}).multiDay, false)
		})
	})

	describe('allDay', () => {
		it('is a stored flag, not inferred from the times', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }), allDay: true }).allDay, true)
			// Midnight bounds alone no longer imply all-day — the flag is explicit.
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }) }).allDay, false)
		})

		it('defaults to false', () => {
			assert.equal(new Entry({ start: day.add({ hours: 9 }), end: day.add({ hours: 10 }) }).allDay, false)
			assert.equal(new Entry({}).allDay, false)
		})
	})

	const at = (d: number, hour: number, minute = 0) => day.add({ days: d }).with({ hour, minute })

	describe('effectiveEnd / inclusiveEnd', () => {
		it('returns the stored end when it is after the start', () => {
			assert.equal(new Entry({ start: at(0, 9), end: at(0, 10) }).effectiveEnd.valueOf(), at(0, 10).valueOf())
		})

		it('falls back to a single all-day day when the end is missing', () => {
			assert.equal(new Entry({ start: day, allDay: true }).effectiveEnd.valueOf(), day.add({ days: 1 }).valueOf())
		})

		it('inclusiveEnd is the last covered day for an all-day span', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 3 }), allDay: true }).inclusiveEnd.valueOf(), day.add({ days: 2 }).valueOf())
		})
	})

	describe('moveStart', () => {
		it('moves a timed entry, preserving its duration', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.moveStart(at(3, 14))
			assert.equal(e.start!.valueOf(), at(3, 14).valueOf())
			assert.equal(e.end!.valueOf(), at(3, 15).valueOf())
		})

		it('moving back and forth never stretches a timed entry', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.moveStart(at(6, 9))
			e.moveStart(at(0, 9))
			assert.equal(e.end!.valueOf() - e.start!.valueOf(), 60 * 60_000)
		})

		it('shifts an all-day span by whole days, keeping its length', () => {
			const e = new Entry({ start: day, end: day.add({ days: 7 }), allDay: true })
			e.moveStart(day.add({ days: 3 }))
			assert.equal(e.start!.valueOf(), day.add({ days: 3 }).valueOf())
			assert.equal(e.end!.valueOf(), day.add({ days: 10 }).valueOf())
		})
	})

	describe('setEnd', () => {
		it('sets a timed end, keeping the start', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.setEnd(at(0, 11))
			assert.equal(e.end!.valueOf(), at(0, 11).valueOf())
		})

		it('snaps a timed end at/under the start to a one-snap minimum', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.setEnd(at(0, 8))
			assert.equal(e.end!.valueOf(), at(0, 9, 15).valueOf())
		})

		it('takes an inclusive last day for all-day, clamping below the start to a single day', () => {
			const e = new Entry({ start: day, end: day.add({ days: 1 }), allDay: true })
			e.setEnd(day.add({ days: 2 })) // inclusive day 2 → exclusive day 3
			assert.equal(e.end!.valueOf(), day.add({ days: 3 }).valueOf())
			e.setEnd(day.subtract({ days: 1 })) // before start → single day
			assert.equal(e.end!.valueOf(), day.add({ days: 1 }).valueOf())
		})
	})

	describe('setAllDay', () => {
		it('snaps a timed entry to the day(s) it covers', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.setAllDay(true)
			assert.equal(e.allDay, true)
			assert.equal(e.start!.valueOf(), day.valueOf())
			assert.equal(e.end!.valueOf(), day.add({ days: 1 }).valueOf())
		})

		it('restores a default 09:00–10:00 slot when turned off', () => {
			const e = new Entry({ start: day, end: day.add({ days: 1 }), allDay: true })
			e.setAllDay(false)
			assert.equal(e.allDay, false)
			assert.equal(e.start!.valueOf(), at(0, 9).valueOf())
			assert.equal(e.end!.valueOf(), at(0, 10).valueOf())
		})
	})
})
