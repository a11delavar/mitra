import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from './Entry.js'
import { EntryChange } from './EntryChange.js'
import { EntryRelations } from './EntryRelations.js'
import { EntryType } from './EntryType.js'
import { type RelationInit } from './Relation.js'
import { RelationGraph } from './RelationGraph.js'
import { RelationType } from './RelationType.js'
import { ShiftStrategy } from './ShiftStrategy.js'

const DAY = 24 * 60 * 60 * 1000
const day = (index: number) => new DateTime(Date.UTC(2026, 7, index))

describe('ShiftStrategy', () => {
	/** A task ON day `at`, with no duration — an entry without an end IS its own end, which keeps the
	 * arithmetic in whole days and the expectations readable. */
	const task = (uid: string, at: number, relations: Array<RelationInit> = [], init: Partial<Entry> = {}) => {
		const entry = new Entry({ id: uid, sourceId: 's', uid, type: EntryType.Task, heading: uid, start: day(at), ...init })
		entry.relations = EntryRelations.of(uid, relations).value
		return entry
	}
	const blocks = (predecessorUid: string, gap?: string) => ({ type: RelationType.FinishToStart, targetUid: predecessorUid, gap })

	/** The moved entry is already where the gesture put it — the planner reads geometry, not gestures. */
	const moveOf = (entry: Entry, days: number) => {
		const before = entry.clone()
		entry.start = entry.start!.add({ days })
		entry.end = entry.end?.add({ days })
		return EntryChange.of(entry, before)
	}

	/** uid → the shift the plan would apply, in days. */
	const shifts = (plan: { writes: ReadonlyArray<{ entry: Entry, mutate: (entry: Entry) => void }> }) => Object.fromEntries(plan.writes.map(write => {
		const probe = write.entry.clone()
		const from = probe.start!.valueOf()
		write.mutate(probe)
		return [write.entry.uid!, (probe.start!.valueOf() - from) / DAY]
	}))

	describe('Minimum — keep the chain intact', () => {
		it('ATTENUATES along the chain and stops at the first link with slack to absorb it', () => {
			// a ──2d slack──> b ──0d──> c ──5d──> d. Moving a by +3 pushes b and c by 1, and stops.
			const a = task('a', 1)
			const graph = RelationGraph.of([a, task('b', 3, [blocks('a')]), task('c', 3, [blocks('b')]), task('d', 8, [blocks('c')])])

			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(graph, moveOf(a, 3))), { b: 1, c: 1 })
		})

		it('plans NOTHING when the predecessor moves earlier — nothing is broken by that', () => {
			const a = task('a', 5)
			const graph = RelationGraph.of([a, task('b', 6, [blocks('a')])])

			assert.equal(ShiftStrategy.Minimum.plan(graph, moveOf(a, -3)).isEmpty, true)
		})

		it('takes the LARGEST deficit when a dependent waits on several predecessors', () => {
			const early = task('early', 1)
			const graph = RelationGraph.of([early, task('late', 5), task('c', 2, [blocks('early'), blocks('late')])])

			// `c` already violates `late`; moving `early` past it must not "repair" that too.
			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(graph, moveOf(early, 2))), { c: 3 })
		})

		it('leaves a chain that was already broken before the gesture alone', () => {
			const a = task('a', 1)
			const graph = RelationGraph.of([a, task('b', 2, [blocks('a')]), task('unrelated', 5), task('broken', 1, [blocks('unrelated')])])

			assert.deepEqual(Object.keys(shifts(ShiftStrategy.Minimum.plan(graph, moveOf(a, 2)))), ['b'])
		})

		it('reads the GAP as a real lead/lag, not as a reason to abstain', () => {
			const lagged = task('a', 1)
			const laggedGraph = RelationGraph.of([lagged, task('b', 2, [blocks('a', 'P2D')])])
			// b must start two days after a ends, so it moves further than the bare coupling would ask.
			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(laggedGraph, moveOf(lagged, 1))), { b: 2 })

			// A negative gap is a LEAD: the pair may overlap by that much, so nothing has to move.
			const led = task('a', 1)
			const ledGraph = RelationGraph.of([led, task('b', 2, [blocks('a', '-P2D')])])
			assert.equal(ShiftStrategy.Minimum.plan(ledGraph, moveOf(led, 1)).isEmpty, true)
		})

		it('withholds a verdict on a gap it cannot read, rather than guessing at zero', () => {
			const a = task('a', 1)
			const graph = RelationGraph.of([a, task('b', 2, [blocks('a', 'not a duration')])])

			assert.equal(ShiftStrategy.Minimum.plan(graph, moveOf(a, 3)).isEmpty, true)
		})

		it('rounds an all-day dependent up to whole days — it has no clock time to land on', () => {
			// An hour long on purpose: the deficit lands mid-day, and an all-day entry cannot.
			const a = task('a', 1, [], { end: day(1).add({ hours: 1 }) })
			const graph = RelationGraph.of([a, task('b', 2, [blocks('a')], { allDay: true, end: day(3) })])

			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(graph, moveOf(a, 2))), { b: 2 })
		})

		it('reports a recurring dependent instead of rewriting its rule, and an undated one instead of dating it', () => {
			const a = task('a', 1)
			const series = task('series', 2, [blocks('a')], { recurrenceMasterId: 'series' })
			const undated = task('undated', 2, [blocks('a')], { start: undefined, end: undefined })
			const plan = ShiftStrategy.Minimum.plan(RelationGraph.of([a, series, undated]), moveOf(a, 3))

			assert.deepEqual(plan.writes, [])
			assert.deepEqual(plan.skipped.map(item => [item.entry.uid, item.reason]).sort(), [['series', 'repeats']])
		})

		it('never moves the entry the user placed, even where a cycle points back at it', () => {
			const b = task('b', 5, [blocks('a')])
			const graph = RelationGraph.of([task('a', 4, [blocks('b')]), b])

			assert.equal(Object.keys(shifts(ShiftStrategy.Minimum.plan(graph, moveOf(b, -3)))).includes('b'), false)
		})

		it('terminates on a cycle instead of pushing forever', () => {
			const a = task('a', 1, [blocks('b')])
			const graph = RelationGraph.of([a, task('b', 2, [blocks('a')])])

			assert.equal(ShiftStrategy.Minimum.plan(graph, moveOf(a, 3)).count <= 1, true)
		})

		it('PULLS a predecessor earlier when the moved entry lands before what it waits for', () => {
			// The mirror of the forward case: a coupling breaks the same way whichever end was dragged,
			// and the entry the user just placed is the one thing that must not move.
			const b = task('b', 5, [blocks('a')])
			const graph = RelationGraph.of([task('a', 4), b])

			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(graph, moveOf(b, -3))), { a: -2 })
		})

		it('carries the pull further up the chain, one link at a time', () => {
			const c = task('c', 5, [blocks('b')])
			const graph = RelationGraph.of([task('a', 3), task('b', 4, [blocks('a')]), c])

			// c lands on day 1: b must be at 1 or earlier, which drags a with it.
			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(graph, moveOf(c, -4))), { b: -3, a: -2 })
		})

		it('answers for a RESIZE from either side — the geometry broke, not the gesture', () => {
			// Dragging the dependent's START earlier into its predecessor is the case that used to be
			// silent while the same overlap made the other way round asked.
			const b = task('b', 5, [blocks('a')], { end: day(6) })
			const graph = RelationGraph.of([task('a', 4), b])
			const before = b.clone()
			b.start = day(2)

			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(graph, EntryChange.of(b, before))), { a: -2 })
		})

		it('takes a shifted entry SUBTREE with it — nobody aimed at those, and leaving them strands them', () => {
			const a = task('a', 1)
			const child = task('child', 4, [{ type: RelationType.Parent, targetUid: 'b' }])
			const graph = RelationGraph.of([a, task('b', 3, [blocks('a')]), child])

			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(graph, moveOf(a, 3))), { b: 1, child: 1 })
		})

		it('couples the boundaries its TYPE names, not always finish-to-start', () => {
			const a = task('a', 5)
			const startToStart = RelationGraph.of([a, task('b', 6, [{ type: RelationType.StartToStart, targetUid: 'a' }])])
			assert.deepEqual(shifts(ShiftStrategy.Minimum.plan(startToStart, moveOf(a, 3))), { b: 2 })
		})
	})

	describe('Maintain — the whole chain by the same amount', () => {
		it('moves every downstream entry by the delta, slack and all', () => {
			const a = task('a', 1)
			const graph = RelationGraph.of([a, task('b', 3, [blocks('a')]), task('c', 3, [blocks('b')]), task('d', 8, [blocks('c')])])

			assert.deepEqual(shifts(ShiftStrategy.Maintain.plan(graph, moveOf(a, 3))), { b: 3, c: 3, d: 3 })
		})

		it('pulls the chain back when the move was backwards — this is the reversible one', () => {
			const a = task('a', 5)
			const graph = RelationGraph.of([a, task('b', 6, [blocks('a')])])

			assert.deepEqual(shifts(ShiftStrategy.Maintain.plan(graph, moveOf(a, -3))), { b: -3 })
		})

		it('carries the chain on BOTH sides — the authored intervals sit either side of the dragged entry', () => {
			const c = task('c', 5, [blocks('b')])
			const graph = RelationGraph.of([task('a', 1), task('b', 3, [blocks('a')]), c])

			assert.deepEqual(shifts(ShiftStrategy.Maintain.plan(graph, moveOf(c, 2))), { a: 2, b: 2 })
		})

		it('plans NOTHING for a resize: there is no single amount everything moved by', () => {
			const a = task('a', 1)
			const graph = RelationGraph.of([a, task('b', 4, [blocks('a')])])
			const before = a.clone()
			a.end = a.start!.add({ days: 3 })

			assert.equal(ShiftStrategy.Maintain.plan(graph, EntryChange.of(a, before)).isEmpty, true)
		})
	})

	describe('the row of answers', () => {
		it('is three distinct plans only where slack exists to tell them apart', () => {
			const a = task('a', 1)
			const slack = RelationGraph.of([a, task('b', 3, [blocks('a')])])
			const change = moveOf(a, 3)
			const [none, minimum, maintain] = ShiftStrategy.all.map(strategy => strategy.plan(slack, change))

			assert.equal(none!.isEmpty, true)
			assert.equal(minimum!.equals(maintain!), false)
		})

		it('collapses to two on a TIGHT chain, where keeping it intact IS moving it all', () => {
			// No slack at all: b starts exactly where a ends, so the least that clears the coupling is
			// the whole delta and the two answers coincide.
			const a = task('a', 1)
			const tight = RelationGraph.of([a, task('b', 1, [blocks('a')])])
			const change = moveOf(a, 3)

			assert.equal(ShiftStrategy.Minimum.plan(tight, change).equals(ShiftStrategy.Maintain.plan(tight, change)), true)
		})

		it('collapses to two on a BACKWARDS move, where keeping it intact IS doing nothing', () => {
			const a = task('a', 5)
			const graph = RelationGraph.of([a, task('b', 6, [blocks('a')])])
			const change = moveOf(a, -3)

			assert.equal(ShiftStrategy.Minimum.plan(graph, change).equals(ShiftStrategy.None.plan()), true)
		})
	})
})
