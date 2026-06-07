import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from '../shared/Entry.js'
import { EntrySegments } from './EntrySegments.js'

describe('EntrySegments', () => {
	const base = new DateTime().dayStart

	describe('for (slicing + links)', () => {
		it('makes one unlinked segment for a single-day timed entry', () => {
			const segments = EntrySegments.for(new Entry({ start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) }))
			assert.equal(segments.length, 1)
			assert.equal(segments[0]!.hasPrevious, false)
			assert.equal(segments[0]!.hasNext, false)
			assert.equal(segments[0]!.startMinute, 9 * 60 + 1)
			assert.equal(segments[0]!.endMinute, 10 * 60 + 1)
			assert.equal(segments[0]!.allDay, false)
		})

		it('links a multi-day entry and clamps the interior pieces to the day edges', () => {
			const segments = EntrySegments.for(new Entry({ start: base.add({ hours: 22 }), end: base.add({ hours: 50 }) }))
			assert.equal(segments.length, 3)
			assert.equal(segments[0]!.next, segments[1])
			assert.equal(segments[1]!.previous, segments[0])
			assert.equal(segments[1]!.startMinute, 1) // continues from before → clamped to top
			assert.equal(segments[1]!.endMinute, 1441) // continues past → clamped to bottom
			assert.equal(segments[1]!.allDay, true) // a multi-day chunk renders as a block
			assert.equal(segments[2]!.endMinute, 2 * 60 + 1)
		})

		it('returns the same instances on repeated calls (stable identity)', () => {
			const entry = new Entry({ start: base, end: base.add({ days: 2 }) })
			assert.equal(EntrySegments.for(entry)[0], EntrySegments.for(entry)[0])
		})
	})

	describe('of', () => {
		it('reuses the cohort for the same inputs and rebuilds when entries change', () => {
			const days = [base, base.add({ days: 1 })]
			const entries = [new Entry({ start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })]
			assert.equal(EntrySegments.of(entries, days), EntrySegments.of(entries, days))
			assert.notEqual(EntrySegments.of(entries, days), EntrySegments.of([...entries], days))
		})
	})

	describe('timedOn', () => {
		it('puts overlapping events in side-by-side columns and a lone event full-width', () => {
			const a = new Entry({ heading: 'A', start: base.add({ hours: 9 }), end: base.add({ hours: 11 }) })
			const b = new Entry({ heading: 'B', start: base.add({ hours: 10 }), end: base.add({ hours: 12 }) })
			const lone = new Entry({ heading: 'Lone', start: base.add({ hours: 14 }), end: base.add({ hours: 15 }) })

			const bars = EntrySegments.of([a, b, lone], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('A'), { slot: 0, total: 2, span: 1 })
			assert.deepEqual(overlap('B'), { slot: 1, total: 2, span: 1 })
			assert.deepEqual(overlap('Lone'), { slot: 0, total: 1, span: 1 })
		})

		it('excludes all-day entries and events on other days', () => {
			const meeting = new Entry({ heading: 'Meeting', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const holiday = new Entry({ heading: 'Holiday', start: base, end: base.add({ days: 1 }), allDay: true })

			const cohort = EntrySegments.of([meeting, holiday], [base, base.add({ days: 1 })])
			assert.deepEqual(cohort.timedOn(base).map(s => s.entry.heading), ['Meeting'])
			assert.equal(cohort.timedOn(base.add({ days: 1 })).length, 0)
		})

		it('widens a segment into a later column left free by neighbours (span > 1)', () => {
			const a = new Entry({ heading: 'A', start: base.with({ hour: 9 }), end: base.with({ hour: 12 }) })
			const x = new Entry({ heading: 'X', start: base.with({ hour: 9 }), end: base.with({ hour: 9, minute: 30 }) })
			const w = new Entry({ heading: 'W', start: base.with({ hour: 10 }), end: base.with({ hour: 11 }) })
			const b = new Entry({ heading: 'B', start: base.with({ hour: 10, minute: 15 }), end: base.with({ hour: 10, minute: 45 }) })

			const bars = EntrySegments.of([a, x, w, b], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('A'), { slot: 0, total: 3, span: 1 })
			assert.deepEqual(overlap('X'), { slot: 1, total: 3, span: 2 }) // its column 2 is free during 9:00–9:30
		})
	})

	describe('runsIn', () => {
		const week = Array.from({ length: 7 }, (_, i) => base.add({ days: i }))

		it('returns one representative per entry whose run touches the window, longest-first', () => {
			const trip = new Entry({ heading: 'Trip', start: base.add({ days: 1 }), end: base.add({ days: 4 }) })
			const day = new Entry({ heading: 'Day', start: base.add({ days: 1 }), end: base.add({ days: 2 }) })

			const reps = EntrySegments.of([day, trip], week).runsIn(base, base.add({ days: 6 }), () => true)

			assert.deepEqual(reps.map(s => s.entry.heading), ['Trip', 'Day']) // same start day → longer run first
			assert.ok(reps.every(s => s.date!.dayStart.equals(base.add({ days: 1 }).dayStart)))
		})

		it('clips a run that starts before the window to the first in-range day and flags it', () => {
			const ongoing = new Entry({ heading: 'Ongoing', start: base.subtract({ days: 3 }), end: base.add({ days: 2 }) })

			const [rep] = EntrySegments.of([ongoing], week).runsIn(base, base.add({ days: 6 }), () => true)

			assert.equal(rep!.date!.dayStart.equals(base.dayStart), true)
			assert.equal(rep!.hasPrevious, true) // its run continues off the left edge
		})

		it('honours the accept predicate', () => {
			const holiday = new Entry({ heading: 'Holiday', start: base, end: base.add({ days: 1 }), allDay: true })
			const meeting = new Entry({ heading: 'Meeting', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })

			const reps = EntrySegments.of([holiday, meeting], week).runsIn(base, base.add({ days: 6 }), entry => !!entry.allDay)
			assert.deepEqual(reps.map(s => s.entry.heading), ['Holiday'])
		})
	})

	describe('laneRank', () => {
		it('ranks multi-day spans top, then all-day, then timed, then undated', () => {
			assert.equal(EntrySegments.laneRank(new Entry({ start: base, end: base.add({ days: 2 }) })), 0)
			// A real single-day all-day entry is stored end = start + 1 day (exclusive); it must rank as
			// all-day (1), not as a multi-day span (0).
			assert.equal(EntrySegments.laneRank(new Entry({ start: base, end: base.add({ days: 1 }), allDay: true })), 1)
			assert.equal(EntrySegments.laneRank(new Entry({ start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })), 2)
			assert.equal(EntrySegments.laneRank(new Entry({})), 3)
		})
	})

	describe('monthWeek', () => {
		const week = Array.from({ length: 7 }, (_, i) => base.add({ days: i }))
		const trip = new Entry({ heading: 'Trip', start: base, end: base.add({ days: 3 }) })
		const day = new Entry({ heading: 'Day', start: base.add({ days: 1 }), end: base.add({ days: 2 }) })

		it('places each entry as a spanning bar at its packed slot', () => {
			const { bars, hiddenByColumn } = EntrySegments.of([day, trip], week).monthWeek(week, 4)
			const bar = (heading: string) => bars.find(b => b.segment.entry.heading === heading)!

			assert.deepEqual({ ...bar('Trip'), segment: 0 }, { segment: 0, startColumn: 0, span: 3, slot: 0, clippedRight: false })
			assert.deepEqual({ ...bar('Day'), segment: 0 }, { segment: 0, startColumn: 1, span: 1, slot: 1, clippedRight: false })
			assert.deepEqual([...hiddenByColumn], [0, 0, 0, 0, 0, 0, 0])
		})

		it('flags a bar whose run continues past the week as clipped, spanning to the week edge', () => {
			const long = new Entry({ heading: 'Long', start: base, end: base.add({ days: 9 }) })
			const [bar] = EntrySegments.of([long], week).monthWeek(week, 4).bars
			assert.equal(bar!.clippedRight, true)
			assert.equal(bar!.span, 7)
		})

		it('counts events past the slot cap as per-column overflow', () => {
			const { bars, hiddenByColumn } = EntrySegments.of([day, trip], week).monthWeek(week, 2)

			assert.deepEqual(bars.map(b => b.segment.entry.heading), ['Trip']) // slot 0 fits; the +1 overflows
			assert.deepEqual([...hiddenByColumn], [0, 1, 0, 0, 0, 0, 0])
		})
	})

	describe('monthSlots', () => {
		it('shares a row for date-disjoint events, bumps overlapping ones, and floats spanning bars to the top', () => {
			const trip = new Entry({ heading: 'Trip', start: base, end: base.add({ days: 3 }) })
			const early = new Entry({ heading: 'Early', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const late = new Entry({ heading: 'Late', start: base.add({ days: 4 }).with({ hour: 9 }), end: base.add({ days: 4 }).with({ hour: 10 }) })

			const slots = EntrySegments.of([early, late, trip], [base]).monthSlots
			assert.equal(slots.get(trip), 0) // multi-day span → top row
			assert.equal(slots.get(early), 1) // overlaps the trip on day 0 → next row
			assert.equal(slots.get(late), 0) // date-disjoint from the trip → reuses the top row
		})
	})
})
