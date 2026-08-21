import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Relation } from './Relation.js'
import { RelationSection, RelationType } from './RelationType.js'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'

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
				[RelationType.FinishToStart, 'a', null],
				[RelationType.Parent, 'b', null],
				[RelationType.Parent, 'b', 'PT1D'],
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

	describe('parse (the wire boundary)', () => {
		it('keeps the tri-state and rejects junk as Relation.invalid, never silently', () => {
			assert.equal(Relation.parse(undefined), undefined)
			assert.equal(Relation.parse(null), null)
			assert.equal(Relation.parse('nonsense'), Relation.invalid)
			assert.equal(Relation.parse([{ type: 'PARENT' }]), Relation.invalid) // no target
			assert.equal(Relation.parse([{ type: 'PARENT', targetUid: 'x', gap: 5 }]), Relation.invalid)
			const parsed = Relation.parse([{ type: 'parent', targetUid: ' x ' }])
			assert.ok(Array.isArray(parsed))
			assert.deepEqual(parsed.map(relation => [relation.type, relation.targetUid]), [[RelationType.Parent, 'x']])
		})
	})

	describe('listEquals', () => {
		it('is order-insensitive and representation-tolerant (plain DTOs compare like instances)', () => {
			const a = [{ type: RelationType.Parent, targetUid: 'x' }, { type: RelationType.FinishToStart, targetUid: 'y' }]
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

	describe('RelationType', () => {
		it('is one instance per value — of() answers the same identity for any spelling', () => {
			assert.equal(RelationType.of('parent'), RelationType.Parent)
			assert.equal(RelationType.of(' FINISHTOSTART '), RelationType.FinishToStart)
			assert.equal(RelationType.of(RelationType.Child), RelationType.Child)
			// Unknown values are DATA, not errors — opaque instances, cached so === still works.
			const foreign = RelationType.of('X-DUPLICATE-OF')
			assert.equal(RelationType.of('x-duplicate-of'), foreign)
			assert.equal(foreign.value, 'X-DUPLICATE-OF')
		})

		it('classifies hierarchy and dependency separately, leaving unknown types uninterpreted', () => {
			assert.equal(RelationType.Parent.family, 'hierarchy')
			assert.equal(RelationType.Child.family, 'hierarchy')
			assert.equal(RelationType.FinishToStart.family, 'dependency')
			assert.equal(RelationType.StartToFinish.family, 'dependency')
			assert.equal(RelationType.Sibling.family, undefined)
			assert.equal(RelationType.of('X-DUPLICATE-OF').family, undefined)
		})

		it('knows its sections from either end — mirror pairs flip, uninterpreted types keep their raw value', () => {
			assert.equal(RelationType.Parent.section, RelationSection.SubtaskOf)
			assert.equal(RelationType.Parent.inverseSection, RelationSection.Subtasks)
			assert.equal(RelationType.Child.section, RelationSection.Subtasks)
			assert.equal(RelationType.Child.inverseSection, RelationSection.SubtaskOf)
			for (const type of [RelationType.FinishToStart, RelationType.FinishToFinish, RelationType.StartToStart, RelationType.StartToFinish]) {
				assert.equal(type.section, RelationSection.BlockedBy)
				assert.equal(type.inverseSection, RelationSection.Blocks)
			}
			// Opaque sections come from the same cache, so identity holds for them too.
			assert.equal(RelationType.of('X-DUPLICATE-OF').section, RelationSection.of('X-DUPLICATE-OF'))
			assert.equal(RelationType.of('X-DUPLICATE-OF').section.value, 'X-DUPLICATE-OF')
			assert.ok(RelationSection.BlockedBy.rank < RelationSection.Blocks.rank && RelationSection.Blocks.rank < RelationType.of('X-A').section.rank)
		})

		it('reads hierarchy edges in either authored direction', () => {
			// PARENT on the child (Mitra's canonical direction): the target is the parent.
			assert.deepEqual(RelationType.Parent.hierarchyEdge('child', 'parent'), { parent: 'parent', child: 'child' })
			// A foreign CHILD on the parent: the target is the child.
			assert.deepEqual(RelationType.Child.hierarchyEdge('parent', 'child'), { parent: 'parent', child: 'child' })
			assert.equal(RelationType.Sibling.hierarchyEdge('a', 'b'), undefined)
		})

		it('reads all four temporal types as dependent → predecessor', () => {
			for (const type of [RelationType.FinishToStart, RelationType.FinishToFinish, RelationType.StartToStart, RelationType.StartToFinish]) {
				assert.deepEqual(type.dependencyEdge('dependent', 'predecessor'), { dependent: 'dependent', predecessor: 'predecessor' })
			}
			assert.equal(RelationType.Parent.dependencyEdge('a', 'b'), undefined)
		})

		it('looks like its wire value to templates and payloads', () => {
			assert.equal(`${RelationType.Parent}`, 'PARENT')
			assert.equal(JSON.stringify({ type: RelationType.FinishToStart }), '{"type":"FINISHTOSTART"}')
		})
	})

	describe('on Entry', () => {
		const entry = () => new Entry({ id: '1', sourceId: 's', type: EntryType.Task, uid: 'self' })

		it('relateTo normalizes, dedupes and ignores self-references', () => {
			const subject = entry()
			subject.relateTo(RelationType.FinishToStart, 'other')
			subject.relateTo(RelationType.FinishToStart, 'other') // duplicate — no second row
			subject.relateTo(RelationType.Parent, 'self') // self-reference — ignored
			assert.deepEqual(subject.relations?.map(relation => [relation.type, relation.targetUid]), [[RelationType.FinishToStart, 'other']])
		})

		it('unrelate removes by value and collapses an emptied list to null', () => {
			const subject = entry()
			subject.relateTo(RelationType.Parent, 'other')
			subject.unrelate(subject.relations![0]!)
			assert.equal(subject.relations, null)
		})

		it('relations do NOT participate in editEquals — they have their own write path', () => {
			const a = entry()
			const b = entry()
			a.relateTo(RelationType.Parent, 'p')
			assert.equal(a.editEquals(b), true)
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
		assert.deepEqual([...RelationType.authorable], [RelationType.FinishToStart, RelationType.Parent])
		assert.ok(RelationType.Parent.isAuthorable && RelationType.FinishToStart.isAuthorable)
		assert.ok(!RelationType.Child.isAuthorable && !RelationType.of('X-DUPLICATE-OF').isAuthorable)
	})
})
