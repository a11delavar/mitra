import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from '../Entry.js'
import { EntrySegments } from './EntrySegments.js'
import { EntryStore } from './EntryStore.js'

describe('EntrySegments', () => {
	const base = new DateTime().dayStart

	const duringMove = <T>(source: Entry | undefined, ghost: Entry, act: () => T): T => {
		EntryStore.setDragging(source)
		EntryStore.setPreview(ghost)
		try {
			return act()
		} finally {
			EntryStore.setPreview(undefined)
			EntryStore.setDragging(undefined)
		}
	}

	const allDay = (heading: string, from: number, days = 1) =>
		new Entry({ heading, start: base.add({ days: from }), end: base.add({ days: from + days }), allDay: true })

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

		it('gives a zero-duration timed entry a minimum visible slab (end == start)', () => {
			const at = base.add({ hours: 20 })
			const [segment] = EntrySegments.for(new Entry({ start: at, end: at }))
			assert.equal(segment!.startMinute, 20 * 60 + 1)
			assert.equal(segment!.endMinute, 20 * 60 + 1 + 15)
		})

		it('gives a timed entry with no end a minimum visible slab below its start', () => {
			const [segment] = EntrySegments.for(new Entry({ start: base.add({ hours: 20 }) }))
			assert.equal(segment!.startMinute, 20 * 60 + 1)
			assert.ok(segment!.endMinute > segment!.startMinute, 'end must fall below start, never invert')
			assert.equal(segment!.endMinute, 20 * 60 + 1 + 15)
		})

		it('clamps the minimum slab to the grid bottom for a near-midnight start', () => {
			const [segment] = EntrySegments.for(new Entry({ start: base.add({ hours: 23, minutes: 55 }), end: base.add({ hours: 23, minutes: 55 }) }))
			assert.equal(segment!.endMinute, 1441)
		})

		it('runs an entry ending at the next midnight to the day\'s bottom, not a minimum slab', () => {
			const segments = EntrySegments.for(new Entry({ start: base.add({ hours: 13 }), end: base.add({ days: 1 }) }))
			assert.equal(segments.length, 1)
			assert.equal(segments[0]!.startMinute, 13 * 60 + 1)
			assert.equal(segments[0]!.endMinute, 1441)
		})

		it('runs the last day of a multi-day entry ending at midnight to its bottom', () => {
			const segments = EntrySegments.for(new Entry({ start: base.add({ hours: 13 }), end: base.add({ days: 2 }) }))
			assert.equal(segments.length, 2)
			assert.equal(segments[1]!.startMinute, 1)
			assert.equal(segments[1]!.endMinute, 1441)
		})

		it('links a multi-day entry and clamps the interior pieces to the day edges', () => {
			const segments = EntrySegments.for(new Entry({ start: base.add({ hours: 22 }), end: base.add({ hours: 50 }) }))
			assert.equal(segments.length, 3)
			assert.equal(segments[0]!.next, segments[1])
			assert.equal(segments[1]!.previous, segments[0])
			assert.equal(segments[1]!.startMinute, 1)
			assert.equal(segments[1]!.endMinute, 1441)
			assert.equal(segments[1]!.allDay, true)
			assert.equal(segments[2]!.endMinute, 2 * 60 + 1)
		})

		it('returns the same instances on repeated calls (stable identity)', () => {
			const entry = new Entry({ start: base, end: base.add({ days: 2 }) })
			assert.equal(EntrySegments.for(entry)[0], EntrySegments.for(entry)[0])
		})

		it('keeps the same instances after a content-only change', () => {
			const entry = new Entry({ heading: 'Old', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const before = EntrySegments.for(entry)
			entry.heading = 'New'
			assert.equal(EntrySegments.for(entry)[0], before[0])
		})

		it('re-slices after an in-place span change', () => {
			const entry = new Entry({ start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const before = EntrySegments.for(entry)
			entry.moveStart(base.add({ hours: 14 }))
			const after = EntrySegments.for(entry)
			assert.notEqual(after[0], before[0])
			assert.equal(after[0]!.startMinute, 14 * 60 + 1)
			assert.equal(after[0]!.endMinute, 15 * 60 + 1)
		})

		it('re-slices to more segments when a span grows across days', () => {
			const entry = new Entry({ start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			assert.equal(EntrySegments.for(entry).length, 1)
			entry.setEnd(base.add({ days: 1, hours: 10 }))
			assert.equal(EntrySegments.for(entry).length, 2)
		})

		it('keys a create draft and a move ghost distinctly', () => {
			const draft = new Entry({})
			const ghost = new Entry({})
			EntryStore.setPreview(ghost)
			try {
				assert.notEqual(EntrySegments.for(draft)[0]!.id, EntrySegments.for(ghost)[0]!.id)
			} finally {
				EntryStore.setPreview(undefined)
			}
		})

		it('re-slices after an in-place all-day flip', () => {
			const entry = new Entry({ start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const before = EntrySegments.for(entry)
			entry.setAllDay(true, 60)
			assert.notEqual(EntrySegments.for(entry)[0], before[0])
			assert.equal(EntrySegments.for(entry)[0]!.allDay, true)
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

	describe('timedOn with a move ghost', () => {
		it('renders the ghost without folding the entry it previews', () => {
			const source = new Entry({ id: 'a', heading: 'A', start: base.add({ hours: 9 }), end: base.add({ hours: 11 }) })
			const ghost = new Entry({ heading: 'A', start: base.add({ hours: 10 }), end: base.add({ hours: 12 }) })
			EntryStore.setPreview(ghost)
			try {
				const segments = EntrySegments.of([source, ghost], [base]).timedOn(base)
				assert.equal(segments.length, 2)
				assert.deepEqual(segments.find(s => s.entry === source)!.overlap, { slot: 0, total: 1, span: 1, inset: 0 })
				assert.equal(segments.find(s => s.entry === ghost)!.overlap, undefined)
			} finally {
				EntryStore.setPreview(undefined)
			}
		})
	})

	describe('timedOn', () => {
		it('puts near-simultaneous events in side-by-side columns and a lone event full-width', () => {
			const a = new Entry({ heading: 'A', start: base.add({ hours: 9 }), end: base.add({ hours: 11 }) })
			const b = new Entry({ heading: 'B', start: base.add({ hours: 9, minutes: 30 }), end: base.add({ hours: 11, minutes: 30 }) })
			const lone = new Entry({ heading: 'Lone', start: base.add({ hours: 14 }), end: base.add({ hours: 15 }) })

			const bars = EntrySegments.of([a, b, lone], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('A'), { slot: 0, total: 2, span: 1, inset: 0 })
			assert.deepEqual(overlap('B'), { slot: 1, total: 2, span: 1, inset: 0 })
			assert.deepEqual(overlap('Lone'), { slot: 0, total: 1, span: 1, inset: 0 })
		})

		it('cascades a staggered later event above the earlier one instead of splitting the width', () => {
			const a = new Entry({ heading: 'A', start: base.add({ hours: 9 }), end: base.add({ hours: 11 }) })
			const b = new Entry({ heading: 'B', start: base.add({ hours: 10 }), end: base.add({ hours: 12 }) })

			const bars = EntrySegments.of([a, b], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('A'), { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(overlap('B'), { slot: 0, total: 1, span: 1, inset: 1 })
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
			const x = new Entry({ heading: 'X', start: base.with({ hour: 9 }), end: base.with({ hour: 9, minute: 20 }) })
			const b = new Entry({ heading: 'B', start: base.with({ hour: 9, minute: 30 }), end: base.with({ hour: 9, minute: 45 }) })
			const w = new Entry({ heading: 'W', start: base.with({ hour: 9, minute: 35 }), end: base.with({ hour: 10, minute: 30 }) })

			const bars = EntrySegments.of([a, x, b, w], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('A'), { slot: 0, total: 3, span: 1, inset: 0 })
			assert.deepEqual(overlap('X'), { slot: 1, total: 3, span: 2, inset: 0 })
		})

		it('floats a contained late-starting segment above its host instead of splitting the width', () => {
			const block = new Entry({ heading: 'Block', start: base.with({ hour: 17 }), end: base.with({ hour: 21 }) })
			const pills = new Entry({ heading: 'Pills', start: base.with({ hour: 20 }), end: base.with({ hour: 20, minute: 30 }) })

			const bars = EntrySegments.of([block, pills], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('Block'), { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(overlap('Pills'), { slot: 0, total: 1, span: 1, inset: 1 })
		})

		it('keeps the columns below the headroom threshold and floats at exactly the threshold', () => {
			const block = () => new Entry({ heading: 'Block', start: base.with({ hour: 17 }), end: base.with({ hour: 21 }) })
			const late = (minute: number) => new Entry({ heading: 'Late', start: base.with({ hour: 17, minute }), end: base.with({ hour: 18, minute }) })
			const overlapOf = (segments: ReturnType<EntrySegments['timedOn']>, heading: string) => segments.find(s => s.entry.heading === heading)!.overlap

			const under = EntrySegments.of([block(), late(44)], [base]).timedOn(base)
			assert.deepEqual(overlapOf(under, 'Block'), { slot: 0, total: 2, span: 1, inset: 0 })
			assert.deepEqual(overlapOf(under, 'Late'), { slot: 1, total: 2, span: 1, inset: 0 })

			const exact = EntrySegments.of([block(), late(45)], [base]).timedOn(base)
			assert.deepEqual(overlapOf(exact, 'Block'), { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(overlapOf(exact, 'Late'), { slot: 0, total: 1, span: 1, inset: 1 })
		})

		it('floats a segment whose tail pokes past its host, sliding under later chips', () => {
			const block = new Entry({ heading: 'Block', start: base.with({ hour: 17 }), end: base.with({ hour: 21 }) })
			const pills = new Entry({ heading: 'Pills', start: base.with({ hour: 19, minute: 30 }), end: base.with({ hour: 20, minute: 45 }) })
			const gym = new Entry({ heading: 'Gym', start: base.with({ hour: 20, minute: 15 }), end: base.with({ hour: 21, minute: 15 }) })
			const cards = new Entry({ heading: 'Cards', start: base.with({ hour: 21 }), end: base.with({ hour: 22 }) })

			const bars = EntrySegments.of([block, pills, gym, cards], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('Block'), { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(overlap('Pills'), { slot: 0, total: 1, span: 1, inset: 1 })
			assert.deepEqual(overlap('Gym'), { slot: 0, total: 1, span: 1, inset: 2 })
			assert.deepEqual(overlap('Cards'), { slot: 0, total: 1, span: 1, inset: 0 })
		})

		it('cascades a straddling segment — the start decides, never the extent', () => {
			const block = new Entry({ heading: 'Block', start: base.with({ hour: 17 }), end: base.with({ hour: 21 }) })
			const runover = new Entry({ heading: 'Runover', start: base.with({ hour: 20, minute: 30 }), end: base.with({ hour: 22 }) })

			const bars = EntrySegments.of([block, runover], [base]).timedOn(base)
			assert.deepEqual(bars.find(s => s.entry.heading === 'Block')!.overlap, { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(bars.find(s => s.entry.heading === 'Runover')!.overlap, { slot: 0, total: 1, span: 1, inset: 1 })
		})

		it('splits colliding cascade chips side-by-side within their level, keeping the base full-width', () => {
			const block = new Entry({ heading: 'Block', start: base.with({ hour: 17 }), end: base.with({ hour: 21 }) })
			const first = new Entry({ heading: 'First', start: base.with({ hour: 18 }), end: base.with({ hour: 18, minute: 30 }) })
			const clash = new Entry({ heading: 'Clash', start: base.with({ hour: 18, minute: 15 }), end: base.with({ hour: 18, minute: 45 }) })
			const second = new Entry({ heading: 'Second', start: base.with({ hour: 20 }), end: base.with({ hour: 20, minute: 30 }) })

			const bars = EntrySegments.of([block, first, clash, second], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('Block'), { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(overlap('First'), { slot: 0, total: 2, span: 1, inset: 1 })
			assert.deepEqual(overlap('Clash'), { slot: 1, total: 2, span: 1, inset: 1 })
			assert.deepEqual(overlap('Second'), { slot: 0, total: 2, span: 2, inset: 1 })
		})

		it('anchors a fresh full-width group once the running base has ended, beneath a poking tail', () => {
			const sew = new Entry({ heading: 'SEW', start: base.with({ hour: 17 }), end: base.with({ hour: 21 }) })
			const pills = new Entry({ heading: 'Pills', start: base.with({ hour: 20, minute: 45 }), end: base.with({ hour: 22 }) })
			const pgit = new Entry({ heading: 'PGIT', start: base.with({ hour: 21, minute: 45 }), end: base.with({ hour: 22, minute: 45 }) })
			const gym = new Entry({ heading: 'Gym', start: base.with({ hour: 22 }), end: base.with({ hour: 23 }) })

			const bars = EntrySegments.of([sew, pills, pgit, gym], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('SEW'), { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(overlap('Pills'), { slot: 0, total: 1, span: 1, inset: 1 })
			assert.deepEqual(overlap('PGIT'), { slot: 0, total: 2, span: 1, inset: 0 })
			assert.deepEqual(overlap('Gym'), { slot: 1, total: 2, span: 1, inset: 0 })
		})

		it('rides the longest-running mate\'s column when the base is split', () => {
			const a = new Entry({ heading: 'A', start: base.with({ hour: 17 }), end: base.with({ hour: 19 }) })
			const m = new Entry({ heading: 'M', start: base.with({ hour: 17, minute: 30 }), end: base.with({ hour: 21 }) })
			const r = new Entry({ heading: 'R', start: base.with({ hour: 18, minute: 30 }), end: base.with({ hour: 18, minute: 50 }) })

			const bars = EntrySegments.of([a, m, r], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('A'), { slot: 0, total: 2, span: 1, inset: 0 })
			assert.deepEqual(overlap('M'), { slot: 1, total: 2, span: 1, inset: 0 })
			assert.deepEqual(overlap('R'), { slot: 1, total: 2, span: 1, inset: 1 })
		})

		it('treats a multi-day slice as an ordinary block — the day\'s chips cascade over it', () => {
			const overnight = new Entry({ heading: 'Overnight', start: base.subtract({ hours: 2 }), end: base.add({ hours: 2 }) })
			const meeting = new Entry({ heading: 'Meeting', start: base.add({ hours: 1 }), end: base.add({ hours: 2 }) })

			const bars = EntrySegments.of([overnight, meeting], [base]).timedOn(base)
			const slice = bars.find(s => s.entry === overnight)!
			const chip = bars.find(s => s.entry === meeting)!

			assert.deepEqual(slice.overlap, { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(chip.overlap, { slot: 0, total: 1, span: 1, inset: 1 })
			assert.equal(bars[0]!.entry, overnight)
			assert.equal(chip.covers, true)
			assert.equal(slice.covers, false)
		})

		it('splits a multi-day run side-by-side with a chip sharing its start', () => {
			const run = new Entry({ heading: 'Off-site', start: base.add({ hours: 13 }), end: base.add({ days: 2, hours: 13 }) })
			const review = new Entry({ heading: 'Review', start: base.add({ hours: 13 }), end: base.add({ hours: 13, minutes: 45 }) })

			const bars = EntrySegments.of([run, review], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('Off-site'), { slot: 0, total: 2, span: 1, inset: 0 })
			assert.deepEqual(overlap('Review'), { slot: 1, total: 2, span: 1, inset: 0 })
			assert.deepEqual(bars.map(s => s.covers), [false, false])
		})

		it('splits two overlapping multi-day runs into columns like any other pair', () => {
			const first = new Entry({ heading: 'First', start: base.subtract({ hours: 2 }), end: base.add({ hours: 26 }) })
			const second = new Entry({ heading: 'Second', start: base.subtract({ hours: 1 }), end: base.add({ hours: 25 }) })

			const bars = EntrySegments.of([first, second], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('First'), { slot: 0, total: 2, span: 1, inset: 0 })
			assert.deepEqual(overlap('Second'), { slot: 1, total: 2, span: 1, inset: 0 })
		})

		it('marks whatever paints over another box as covering — and side-by-side mates as not', () => {
			const block = new Entry({ heading: 'Block', start: base.with({ hour: 17 }), end: base.with({ hour: 21 }) })
			const pills = new Entry({ heading: 'Pills', start: base.with({ hour: 19, minute: 30 }), end: base.with({ hour: 20, minute: 45 }) })
			const gym = new Entry({ heading: 'Gym', start: base.with({ hour: 20, minute: 15 }), end: base.with({ hour: 21, minute: 15 }) })
			const cards = new Entry({ heading: 'Cards', start: base.with({ hour: 21 }), end: base.with({ hour: 22 }) })

			const bars = EntrySegments.of([block, pills, gym, cards], [base]).timedOn(base)
			const covers = (heading: string) => bars.find(s => s.entry.heading === heading)!.covers

			assert.equal(covers('Block'), false)
			assert.equal(covers('Pills'), true)
			assert.equal(covers('Gym'), true)
			assert.equal(covers('Cards'), true)

			const a = new Entry({ heading: 'A', start: base.add({ hours: 9 }), end: base.add({ hours: 11 }) })
			const b = new Entry({ heading: 'B', start: base.add({ hours: 9, minutes: 30 }), end: base.add({ hours: 11, minutes: 30 }) })
			const mates = EntrySegments.of([a, b], [base]).timedOn(base)
			assert.deepEqual(mates.map(s => s.covers), [false, false])
		})

		it('nests a float on a float one inset step deeper', () => {
			const day = new Entry({ heading: 'Day', start: base.with({ hour: 9 }), end: base.with({ hour: 21 }) })
			const sub = new Entry({ heading: 'Sub', start: base.with({ hour: 10 }), end: base.with({ hour: 15 }) })
			const pill = new Entry({ heading: 'Pill', start: base.with({ hour: 11 }), end: base.with({ hour: 11, minute: 30 }) })

			const bars = EntrySegments.of([day, sub, pill], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('Day'), { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(overlap('Sub'), { slot: 0, total: 1, span: 1, inset: 1 })
			assert.deepEqual(overlap('Pill'), { slot: 0, total: 1, span: 1, inset: 2 })
		})

		it('cascades overlapping floats on the same host, each covering sibling a level deeper', () => {
			const block = new Entry({ heading: 'Block', start: base.with({ hour: 17 }), end: base.with({ hour: 21 }) })
			const pills = new Entry({ heading: 'Pills', start: base.with({ hour: 18, minute: 45 }), end: base.with({ hour: 20 }) })
			const gym = new Entry({ heading: 'Gym', start: base.with({ hour: 19, minute: 15 }), end: base.with({ hour: 20, minute: 15 }) })

			const bars = EntrySegments.of([block, pills, gym], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('Block'), { slot: 0, total: 1, span: 1, inset: 0 })
			assert.deepEqual(overlap('Pills'), { slot: 0, total: 1, span: 1, inset: 1 })
			assert.deepEqual(overlap('Gym'), { slot: 0, total: 1, span: 1, inset: 2 })
		})

		it('returns to the shallow inset once a cascade has run out', () => {
			const block = new Entry({ heading: 'Block', start: base.with({ hour: 9 }), end: base.with({ hour: 18 }) })
			const a = new Entry({ heading: 'A', start: base.with({ hour: 10 }), end: base.with({ hour: 11 }) })
			const b = new Entry({ heading: 'B', start: base.with({ hour: 10, minute: 30 }), end: base.with({ hour: 11, minute: 30 }) })
			const c = new Entry({ heading: 'C', start: base.with({ hour: 12 }), end: base.with({ hour: 12, minute: 30 }) })

			const bars = EntrySegments.of([block, a, b, c], [base]).timedOn(base)
			const overlap = (heading: string) => bars.find(s => s.entry.heading === heading)!.overlap

			assert.deepEqual(overlap('A'), { slot: 0, total: 1, span: 1, inset: 1 })
			assert.deepEqual(overlap('B'), { slot: 0, total: 1, span: 1, inset: 2 })
			assert.deepEqual(overlap('C'), { slot: 0, total: 1, span: 1, inset: 1 })
		})
	})

	describe('runsIn', () => {
		const week = Array.from({ length: 7 }, (_, i) => base.add({ days: i }))

		it('returns one representative per entry whose run touches the window, longest-first', () => {
			const trip = new Entry({ heading: 'Trip', start: base.add({ days: 1 }), end: base.add({ days: 4 }) })
			const day = new Entry({ heading: 'Day', start: base.add({ days: 1 }), end: base.add({ days: 2 }) })

			const reps = EntrySegments.of([day, trip], week).runsIn(base, base.add({ days: 6 }), () => true)

			assert.deepEqual(reps.map(s => s.entry.heading), ['Trip', 'Day'])
			assert.ok(reps.every(s => s.date!.dayStart.equals(base.add({ days: 1 }).dayStart)))
		})

		it('clips a run that starts before the window to the first in-range day and flags it', () => {
			const ongoing = new Entry({ heading: 'Ongoing', start: base.subtract({ days: 3 }), end: base.add({ days: 2 }) })

			const [rep] = EntrySegments.of([ongoing], week).runsIn(base, base.add({ days: 6 }), () => true)

			assert.equal(rep!.date!.dayStart.equals(base.dayStart), true)
			assert.equal(rep!.hasPrevious, true)
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
			const { bars } = EntrySegments.of([day, trip], week).monthWeek(week)
			const bar = (heading: string) => bars.find(b => b.segment.entry.heading === heading)!

			assert.deepEqual({ ...bar('Trip'), segment: 0 }, { segment: 0, startColumn: 0, span: 3, slot: 0, clippedRight: false })
			assert.deepEqual({ ...bar('Day'), segment: 0 }, { segment: 0, startColumn: 1, span: 1, slot: 1, clippedRight: false })
		})

		it('flags a bar whose run continues past the week as clipped, spanning to the week edge', () => {
			const long = new Entry({ heading: 'Long', start: base, end: base.add({ days: 9 }) })
			const [bar] = EntrySegments.of([long], week).monthWeek(week).bars
			assert.equal(bar!.clippedRight, true)
			assert.equal(bar!.span, 7)
		})

		it('places every entry, however deep the packing goes — a dense week clips visually, never here', () => {
			const stack = Array.from({ length: 10 }, (_, i) => new Entry({ heading: `E${i}`, start: base.add({ hours: 9 + i }), end: base.add({ hours: 10 + i }) }))
			const { bars } = EntrySegments.of(stack, week).monthWeek(week)
			assert.equal(bars.length, 10)
			assert.deepEqual([...new Set(bars.map(bar => bar.slot))].length, 10)
		})
	})

	describe('monthSlots', () => {
		it('shares a row for date-disjoint events, bumps overlapping ones, and floats spanning bars to the top', () => {
			const trip = new Entry({ heading: 'Trip', start: base, end: base.add({ days: 3 }) })
			const early = new Entry({ heading: 'Early', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const late = new Entry({ heading: 'Late', start: base.add({ days: 4 }).with({ hour: 9 }), end: base.add({ days: 4 }).with({ hour: 10 }) })

			const slots = EntrySegments.of([early, late, trip], [base]).monthSlots
			assert.equal(slots.get(trip), 0)
			assert.equal(slots.get(early), 1)
			assert.equal(slots.get(late), 0)
		})
	})

	describe('allDaySlots', () => {
		it('bumps overlapping all-day runs into distinct lanes and reuses lanes across disjoint ones', () => {
			const conference = new Entry({ heading: 'Conference', start: base, end: base.add({ days: 3 }), allDay: true })
			const visit = new Entry({ heading: 'Visit', start: base.add({ days: 2 }), end: base.add({ days: 4 }), allDay: true })
			const later = new Entry({ heading: 'Later', start: base.add({ days: 5 }), end: base.add({ days: 6 }), allDay: true })

			const slots = EntrySegments.of([conference, visit, later], [base]).allDaySlots
			assert.equal(slots.get(conference), 0)
			assert.equal(slots.get(visit), 1)
			assert.equal(slots.get(later), 0)
		})

		it('never lets a timed entry occupy a lane', () => {
			const meeting = new Entry({ heading: 'Meeting', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const holiday = new Entry({ heading: 'Holiday', start: base, end: base.add({ days: 1 }), allDay: true })

			const slots = EntrySegments.of([meeting, holiday], [base]).allDaySlots
			assert.equal(slots.get(holiday), 0)
			assert.equal(slots.has(meeting), false)
		})

		it('puts a move ghost in the free lane it will land in, without shifting the packed ones', () => {
			const banner = allDay('Banner', 0, 8)
			const task = allDay('Task', 0)
			const ghost = allDay('Task', 3)

			const slots = duringMove(task, ghost, () => EntrySegments.of([banner, task, ghost], [base]).allDaySlots)
			assert.equal(slots.get(banner), 0)
			assert.equal(slots.get(task), 1)
			assert.equal(slots.get(ghost), 1)
		})

		it('lets a move ghost reuse the cells its own source is vacating', () => {
			const banner = allDay('Banner', 0, 8)
			const trip = allDay('Trip', 1, 3)
			const ghost = allDay('Trip', 2, 3)

			const slots = duringMove(trip, ghost, () => EntrySegments.of([banner, trip, ghost], [base]).allDaySlots)
			assert.equal(slots.get(ghost), 1)
		})

		it('falls back to a fresh lane when a move ghost fits in none', () => {
			const banner = allDay('Banner', 0, 8)
			const task = allDay('Task', 0)
			const other = allDay('Other', 3)
			const ghost = allDay('Task', 3)

			const slots = duringMove(task, ghost, () => EntrySegments.of([banner, task, other, ghost], [base]).allDaySlots)
			assert.equal(slots.get(other), 1)
			assert.equal(slots.get(ghost), 2)
		})
	})

	describe('monthWeek (move ghost)', () => {
		const week = Array.from({ length: 7 }, (_, i) => base.add({ days: i }))

		it('previews a move ghost at the packed slot it will land in', () => {
			const trip = new Entry({ heading: 'Trip', start: base, end: base.add({ days: 3 }) })
			const ghost = new Entry({ heading: 'Ghost', start: base.add({ days: 1 }), end: base.add({ days: 2 }) })

			const { bars } = duringMove(undefined, ghost, () => EntrySegments.of([trip, ghost], week).monthWeek(week))
			assert.deepEqual(bars.map(bar => bar.segment.entry.heading), ['Trip', 'Ghost'])
			assert.equal(bars.find(bar => bar.segment.entry === ghost)!.slot, 1)
		})
	})
})
