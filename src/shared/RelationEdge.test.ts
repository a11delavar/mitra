import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RelationEdge } from './RelationEdge.js'
import { RelationType } from './RelationType.js'

describe('RelationEdge', () => {
	const edge = (ownerUid: string, type: RelationType | string, targetUid: string, gap: string | null = null) =>
		RelationEdge.of(ownerUid, { type, targetUid, gap })

	describe('of', () => {
		it('normalizes BOTH hierarchy authoring directions to the same parent → child edge', () => {
			// The child's own PARENT line and the parent's foreign CHILD line state one fact.
			const owned = edge('child', RelationType.Parent, 'parent')!
			const foreign = edge('parent', RelationType.Child, 'child')!
			assert.deepEqual([owned.family, owned.from, owned.to], ['hierarchy', 'parent', 'child'])
			assert.deepEqual([foreign.family, foreign.from, foreign.to], ['hierarchy', 'parent', 'child'])
			assert.equal(owned.key, foreign.key)
		})

		it('points a dependency predecessor → dependent, whichever temporal type it is', () => {
			for (const type of [RelationType.FinishToStart, RelationType.FinishToFinish, RelationType.StartToStart, RelationType.StartToFinish]) {
				const dependency = edge('dependent', type, 'predecessor')!
				assert.deepEqual([dependency.family, dependency.from, dependency.to], ['dependency', 'predecessor', 'dependent'])
			}
		})

		it('answers undefined for anything that joins no graph — an opaque type, SIBLING, no target', () => {
			assert.equal(edge('a', RelationType.of('X-WAITS-FOR'), 'b'), undefined)
			assert.equal(edge('a', RelationType.Sibling, 'b'), undefined)
			assert.equal(edge('a', RelationType.Parent, ''), undefined)
		})

		it('keeps the two families apart: the same pair may be both, and they are different edges', () => {
			assert.notEqual(edge('a', RelationType.Parent, 'b')!.key, edge('a', RelationType.FinishToStart, 'b')!.key)
		})
	})

	describe('coupling', () => {
		it('names the boundaries each temporal type couples, and none for hierarchy', () => {
			assert.deepEqual(edge('d', RelationType.FinishToStart, 'p')!.coupling, { from: 'end', to: 'start' })
			assert.deepEqual(edge('d', RelationType.FinishToFinish, 'p')!.coupling, { from: 'end', to: 'end' })
			assert.deepEqual(edge('d', RelationType.StartToStart, 'p')!.coupling, { from: 'start', to: 'start' })
			assert.deepEqual(edge('d', RelationType.StartToFinish, 'p')!.coupling, { from: 'start', to: 'end' })
			assert.equal(edge('c', RelationType.Parent, 'p')!.coupling, undefined)
		})
	})

	describe('bestPair — which occurrences connect', () => {
		const at = (hour: number) => ({ start: { valueOf: () => hour }, boundaryOf: (which: 'start' | 'end') => ({ valueOf: () => which === 'start' ? hour : hour + 1 }) as never })

		it('prefers a SATISFIED pair over a nearer one that would read as broken', () => {
			// Gym on Monday and Wednesday blocks a Tuesday session. Wednesday's is nearer in absolute
			// time and comes AFTER, so nearness alone drew a violation the user never authored.
			const dependency = edge('volleyball', RelationType.FinishToStart, 'gym')!
			const monday = at(0)
			const wednesday = at(48)
			const tuesday = at(24)
			assert.deepEqual(dependency.bestPair([monday, wednesday], [tuesday]), { from: monday, to: tuesday })
		})

		it('falls back to the nearest pair when every one of them breaks', () => {
			const dependency = edge('dependent', RelationType.FinishToStart, 'predecessor')!
			const near = at(10)
			const far = at(100)
			const dependent = at(5)
			assert.deepEqual(dependency.bestPair([near, far], [dependent]), { from: near, to: dependent })
		})

		it('is nearness alone for hierarchy, which couples nothing', () => {
			const hierarchy = edge('child', RelationType.Parent, 'parent')!
			const early = at(0)
			const late = at(20)
			assert.deepEqual(hierarchy.bestPair([early, late], [at(21)])?.from, late)
		})

		it('answers undefined when one end renders nothing', () => {
			assert.equal(edge('d', RelationType.FinishToStart, 'p')!.bestPair([], [at(0)]), undefined)
		})
	})

	describe('violatedBy', () => {
		const at = (hour: number) => ({ valueOf: () => hour })
		const entry = (start: number, end: number) => ({ boundaryOf: (which: 'start' | 'end') => (which === 'start' ? at(start) : at(end)) as never })

		it('reads the coupled pair of boundaries, and treats a handover at the same instant as satisfied', () => {
			const finishToStart = edge('d', RelationType.FinishToStart, 'p')!
			assert.equal(finishToStart.violatedBy(entry(9, 11), entry(10, 12)), true)
			assert.equal(finishToStart.violatedBy(entry(9, 11), entry(11, 13)), false)
		})

		it('withholds a verdict where the gap is still an unread duration — see dependency-propagation.md §5', () => {
			assert.equal(edge('d', RelationType.FinishToStart, 'p', 'PT1H')!.violatedBy(entry(9, 11), entry(10, 12)), false)
		})

		it('never judges hierarchy: it couples no boundaries at all', () => {
			assert.equal(edge('c', RelationType.Parent, 'p')!.violatedBy(entry(9, 11), entry(0, 1)), false)
		})
	})
})
