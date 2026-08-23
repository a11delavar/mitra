import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Relation } from './Relation.js'
import { EntryRelations } from './EntryRelations.js'
import { RelationSection, RelationType } from './RelationType.js'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'

describe('Relation', () => {
	describe('from — the one coercion point', () => {
		it('canonicalizes as it coerces: trimmed UPPERCASE type, blank gap as null, absent direction as outgoing', () => {
			const relation = Relation.from({ type: ' finishtostart ', targetUid: ' target ', gap: '  ' })!
			assert.equal(relation.type, RelationType.FinishToStart)
			assert.equal(relation.targetUid, 'target')
			assert.equal(relation.gap, null)
			assert.equal(relation.direction, 'outgoing')
			assert.equal(relation.isOutgoing, true)
		})

		it('answers undefined for a shape that states nothing, which a collection then drops', () => {
			assert.equal(Relation.from({ type: '', targetUid: 'x' }), undefined)
			assert.equal(Relation.from({ type: RelationType.Parent, targetUid: ' ' }), undefined)
		})

		it('gives back a real instance even from a DTO the reviver left plain — behaviour, not a shape', () => {
			const plain = JSON.parse(JSON.stringify(new Relation({ type: RelationType.Parent, targetUid: 'p' }))) as unknown
			const relation = Relation.from(plain as never)!
			assert.equal(relation instanceof Relation, true)
			assert.equal(relation.key, new Relation({ type: RelationType.Parent, targetUid: 'p' }).key)
		})
	})

	describe('key and equals', () => {
		it('separates the two readings of one edge — direction is part of a line identity', () => {
			const owned = Relation.from({ type: RelationType.Parent, targetUid: 'p' })!
			const derived = Relation.from({ type: RelationType.Parent, targetUid: 'p', direction: 'incoming' })!
			assert.notEqual(owned.key, derived.key)
			assert.equal(owned.equals(derived), false)
		})

		it('compares by value across spellings, and is false against nothing', () => {
			const relation = Relation.from({ type: RelationType.Parent, targetUid: 'p' })!
			assert.equal(relation.equals({ type: 'parent', targetUid: 'p' }), true)
			assert.equal(relation.equals({ type: 'parent', targetUid: 'p', gap: 'PT1H' }), false)
			assert.equal(relation.equals(null), false)
		})
	})

	describe('normalize', () => {
		it('uppercases types, trims, dedupes by the full (type, target, gap) triple and sorts', () => {
			const normalized = EntryRelations.of(undefined, [
				{ type: 'parent', targetUid: ' b ' },
				{ type: 'FINISHTOSTART', targetUid: 'a' },
				{ type: 'PARENT', targetUid: 'b' }, // true duplicate of the first — dropped
				{ type: 'PARENT', targetUid: 'b', gap: 'PT1D' }, // same pair, DIFFERENT gap — a distinct relationship
			]).value
			assert.deepEqual(normalized?.map(relation => [relation.type, relation.targetUid, relation.gap]), [
				[RelationType.FinishToStart, 'a', null],
				[RelationType.Parent, 'b', null],
				[RelationType.Parent, 'b', 'PT1D'],
			])
		})

		it('collapses none to null — empty array, all-junk input, and nullish all mean the same', () => {
			assert.equal(EntryRelations.of(undefined, []).value, null)
			assert.equal(EntryRelations.of(undefined, null).value, null)
			assert.equal(EntryRelations.of(undefined, undefined).value, null)
			assert.equal(EntryRelations.of(undefined, [{ type: '', targetUid: 'x' }, { type: 'PARENT', targetUid: ' ' }]).value, null)
		})

		it('keeps gap as an opaque string, normalizing absence to null', () => {
			const normalized = EntryRelations.of(undefined, [{ type: 'FINISHTOSTART', targetUid: 'a', gap: ' PT30M ' }]).value
			assert.equal(normalized![0]!.gap, 'PT30M')
			assert.equal(EntryRelations.of(undefined, [{ type: 'PARENT', targetUid: 'b' }]).value![0]!.gap, null)
		})
	})

	describe('parse (the wire boundary)', () => {
		it('keeps the tri-state and rejects junk as EntryRelations.invalid, never silently', () => {
			assert.equal(EntryRelations.parse(undefined), undefined)
			assert.equal(EntryRelations.parse(null), null)
			assert.equal(EntryRelations.parse('nonsense'), EntryRelations.invalid)
			assert.equal(EntryRelations.parse([{ type: 'PARENT' }]), EntryRelations.invalid) // no target
			assert.equal(EntryRelations.parse([{ type: 'PARENT', targetUid: 'x', gap: 5 }]), EntryRelations.invalid)
			const parsed = EntryRelations.parse([{ type: 'parent', targetUid: ' x ' }])
			assert.ok(Array.isArray(parsed))
			assert.deepEqual(parsed.map(relation => [relation.type, relation.targetUid]), [[RelationType.Parent, 'x']])
		})

		it('accepts an already-revived instance, not just the plain wire shape', () => {
			const revived = new Relation({ type: RelationType.Parent, targetUid: 'parent' })
			const parsed = EntryRelations.parse([revived])
			assert.ok(Array.isArray(parsed))
			assert.deepEqual(parsed.map(relation => [relation.type, relation.targetUid]), [[RelationType.Parent, 'parent']])
		})

		it('still rejects an item whose type is neither a string nor a RelationType', () => {
			assert.equal(EntryRelations.parse([{ type: { value: 'PARENT' }, targetUid: 'x' }]), EntryRelations.invalid)
			assert.equal(EntryRelations.parse([{ type: '   ', targetUid: 'x' }]), EntryRelations.invalid)
		})
	})

	describe('writes — what may be persisted', () => {
		it('is the OWNED half alone, canonical null for none', () => {
			const bag = EntryRelations.of('self', [
				{ type: RelationType.Parent, targetUid: 'p' },
				{ type: RelationType.FinishToStart, targetUid: 'd', direction: 'incoming' },
			])
			assert.deepEqual(bag.writes?.map(relation => relation.targetUid), ['p'])
			assert.equal(EntryRelations.of('self', [{ type: RelationType.Parent, targetUid: 'p', direction: 'incoming' }]).writes, null)
		})

		it('parse keeps only what the client may store — a derived line it PUTs back is dropped', () => {
			const parsed = EntryRelations.parse([
				{ type: 'PARENT', targetUid: 'p' },
				{ type: 'PARENT', targetUid: 'c', direction: 'incoming' },
			])
			assert.deepEqual((parsed as Array<Relation>).map(relation => relation.targetUid), ['p'])
		})

		it('parse rejects a direction that is neither, rather than coercing it into the wrong row', () => {
			assert.equal(EntryRelations.parse([{ type: 'PARENT', targetUid: 'p', direction: 'sideways' }]), EntryRelations.invalid)
		})

		it('writesDiffer ignores the derived half entirely — else every entry goes dirty on every sync', () => {
			const stored = EntryRelations.of('self', [{ type: RelationType.Parent, targetUid: 'p' }])
			const served = EntryRelations.of('self', [
				{ type: RelationType.Parent, targetUid: 'p' },
				{ type: RelationType.Parent, targetUid: 'c', direction: 'incoming' },
			])
			assert.equal(stored.writesDiffer(served), false)
			assert.equal(stored.equals(served), false)
			assert.equal(stored.writesDiffer(EntryRelations.of('self', [{ type: RelationType.Parent, targetUid: 'other' }])), true)
		})
	})

	describe('listEquals', () => {
		it('is order-insensitive and representation-tolerant (plain DTOs compare like instances)', () => {
			const a = [{ type: RelationType.Parent, targetUid: 'x' }, { type: RelationType.FinishToStart, targetUid: 'y' }]
			const b = [{ type: 'finishtostart', targetUid: 'y' }, { type: 'PARENT', targetUid: 'x', gap: null }]
			assert.equal(EntryRelations.of(undefined, a).equals(EntryRelations.of(undefined, b)), true)
		})

		it('treats null, undefined and empty as the same none', () => {
			assert.equal(EntryRelations.of(undefined, null).equals(EntryRelations.of(undefined, undefined)), true)
			assert.equal(EntryRelations.of(undefined, []).equals(EntryRelations.of(undefined, null)), true)
			assert.equal(EntryRelations.of(undefined, [{ type: 'PARENT', targetUid: 'x' }]).equals(EntryRelations.of(undefined, null)), false)
		})

		it('distinguishes gap values — a lead/lag change is a real change', () => {
			assert.equal(EntryRelations.of(undefined, [{ type: 'FINISHTOSTART', targetUid: 'a', gap: 'PT1D' }]).equals(EntryRelations.of(undefined, [{ type: 'FINISHTOSTART', targetUid: 'a' }])), false)
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

	it('a temporal type knows which boundaries it couples; nothing else couples any', () => {
		assert.deepEqual(RelationType.FinishToStart.coupling, { predecessor: 'end', dependent: 'start' })
		assert.deepEqual(RelationType.StartToFinish.coupling, { predecessor: 'start', dependent: 'end' })
		assert.equal(RelationType.Parent.coupling, undefined)
		assert.equal(RelationType.of('X-WAITS-FOR').coupling, undefined)
	})

	it('the UI-authorable subset stays canonical-direction-only', () => {
		assert.deepEqual([...RelationType.authorable], [RelationType.FinishToStart, RelationType.Parent])
		assert.ok(RelationType.Parent.isAuthorable && RelationType.FinishToStart.isAuthorable)
		assert.ok(!RelationType.Child.isAuthorable && !RelationType.of('X-DUPLICATE-OF').isAuthorable)
	})
})
