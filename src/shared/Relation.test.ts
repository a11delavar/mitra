import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Relation, RelationType, AUTHORABLE_RELATION_TYPES } from './Relation.js'
import { Entry, EntryType } from './Entry.js'

describe('Relation', () => {
	describe('normalize', () => {
		it('uppercases types, trims, dedupes by the full (type, target, gap) triple and sorts', () => {
			const normalized = Relation.normalize([
				{ type: 'parent', targetUid: ' b ' },
				{ type: 'FINISHTOSTART', targetUid: 'a' },
				{ type: 'PARENT', targetUid: 'b' }, // true duplicate of the first — dropped
				{ type: 'PARENT', targetUid: 'b', gap: 'PT1D' }, // same pair, DIFFERENT gap — a distinct relationship
			])
			assert.deepEqual(normalized?.map(relation => [relation.type, relation.targetUid, relation.gap]), [
				['FINISHTOSTART', 'a', null],
				['PARENT', 'b', null],
				['PARENT', 'b', 'PT1D'],
			])
		})

		it('collapses none to null — empty array, all-junk input, and nullish all mean the same', () => {
			assert.equal(Relation.normalize([]), null)
			assert.equal(Relation.normalize(null), null)
			assert.equal(Relation.normalize(undefined), null)
			assert.equal(Relation.normalize([{ type: '', targetUid: 'x' }, { type: 'PARENT', targetUid: ' ' }]), null)
		})

		it('keeps gap as an opaque string, normalizing absence to null', () => {
			const normalized = Relation.normalize([{ type: 'FINISHTOSTART', targetUid: 'a', gap: ' PT30M ' }])
			assert.equal(normalized![0]!.gap, 'PT30M')
			assert.equal(Relation.normalize([{ type: 'PARENT', targetUid: 'b' }])![0]!.gap, null)
		})
	})

	describe('listEquals', () => {
		it('is order-insensitive and representation-tolerant (plain DTOs compare like instances)', () => {
			const a = [new Relation({ type: 'PARENT', targetUid: 'x' }), new Relation({ type: 'FINISHTOSTART', targetUid: 'y' })]
			const b = [{ type: 'finishtostart', targetUid: 'y' }, { type: 'PARENT', targetUid: 'x', gap: null }]
			assert.equal(Relation.listEquals(a, b), true)
		})

		it('treats null, undefined and empty as the same none', () => {
			assert.equal(Relation.listEquals(null, undefined), true)
			assert.equal(Relation.listEquals([], null), true)
			assert.equal(Relation.listEquals([{ type: 'PARENT', targetUid: 'x' }], null), false)
		})

		it('distinguishes gap values — a lead/lag change is a real change', () => {
			assert.equal(Relation.listEquals(
				[{ type: 'FINISHTOSTART', targetUid: 'a', gap: 'PT1D' }],
				[{ type: 'FINISHTOSTART', targetUid: 'a' }],
			), false)
		})
	})

	describe('constraint families and edges', () => {
		it('classifies hierarchy and dependency separately, leaving unknown types uninterpreted', () => {
			assert.equal(Relation.familyOf(RelationType.Parent), 'hierarchy')
			assert.equal(Relation.familyOf(RelationType.Child), 'hierarchy')
			assert.equal(Relation.familyOf(RelationType.FinishToStart), 'dependency')
			assert.equal(Relation.familyOf(RelationType.StartToFinish), 'dependency')
			assert.equal(Relation.familyOf(RelationType.Sibling), undefined)
			assert.equal(Relation.familyOf('X-DUPLICATE-OF'), undefined)
		})

		it('reads hierarchy edges in either authored direction', () => {
			// PARENT on the child (Mitra's canonical direction): the target is the parent.
			assert.deepEqual(Relation.hierarchyEdge('child', { type: RelationType.Parent, targetUid: 'parent' }), { parent: 'parent', child: 'child' })
			// A foreign CHILD on the parent: the target is the child.
			assert.deepEqual(Relation.hierarchyEdge('parent', { type: RelationType.Child, targetUid: 'child' }), { parent: 'parent', child: 'child' })
			assert.equal(Relation.hierarchyEdge('a', { type: RelationType.Sibling, targetUid: 'b' }), undefined)
		})

		it('reads all four temporal types as dependent → predecessor', () => {
			for (const type of [RelationType.FinishToStart, RelationType.FinishToFinish, RelationType.StartToStart, RelationType.StartToFinish]) {
				assert.deepEqual(Relation.dependencyEdge('dependent', { type, targetUid: 'predecessor' }), { dependent: 'dependent', predecessor: 'predecessor' })
			}
			assert.equal(Relation.dependencyEdge('a', { type: RelationType.Parent, targetUid: 'b' }), undefined)
		})
	})

	describe('on Entry', () => {
		const entry = () => new Entry({ id: '1', sourceId: 's', type: EntryType.Task, uid: 'self' })

		it('relateTo normalizes, dedupes and ignores self-references', () => {
			const subject = entry()
			subject.relateTo(RelationType.FinishToStart, 'other')
			subject.relateTo(RelationType.FinishToStart, 'other') // duplicate — no second row
			subject.relateTo(RelationType.Parent, 'self') // self-reference — ignored
			assert.deepEqual(subject.relations?.map(relation => [relation.type, relation.targetUid]), [['FINISHTOSTART', 'other']])
		})

		it('unrelate removes by value and collapses an emptied list to null', () => {
			const subject = entry()
			subject.relateTo(RelationType.Parent, 'other')
			subject.unrelate(subject.relations![0]!)
			assert.equal(subject.relations, null)
		})

		it('relations participate in editEquals — a wire round-trip in another order reads as clean', () => {
			const a = entry()
			const b = entry()
			a.relateTo(RelationType.Parent, 'p')
			a.relateTo(RelationType.FinishToStart, 'q')
			b.relations = [{ type: 'FINISHTOSTART', targetUid: 'q', gap: null }, { type: 'PARENT', targetUid: 'p', gap: null }] as never
			assert.equal(a.editEquals(b), true)
			b.relations = null
			assert.equal(a.editEquals(b), false)
		})

		it('replaces the array rather than mutating it — a shared snapshot keeps its value', () => {
			const subject = entry()
			subject.relateTo(RelationType.Parent, 'p')
			const snapshot = subject.relations
			subject.relateTo(RelationType.Parent, 'q')
			assert.equal(snapshot!.length, 1)
			assert.equal(subject.relations!.length, 2)
		})
	})

	it('the UI-authorable subset stays canonical-direction-only', () => {
		assert.deepEqual([...AUTHORABLE_RELATION_TYPES], [RelationType.FinishToStart, RelationType.Parent])
	})
})
