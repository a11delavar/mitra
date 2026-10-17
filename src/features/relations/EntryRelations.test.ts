import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EntryRelations } from './EntryRelations.js'
import { Relation, type RelationInit } from './Relation.js'
import { RelationSection, RelationType } from './RelationType.js'
import { Entry } from '../entries/Entry.js'
import { EntryType } from '../entries/EntryType.js'

describe('EntryRelations', () => {
	const readings = (bag: EntryRelations) => bag.sections('self').map(({ section, relations }) => [section.value, ...relations.map(relation => `${relation.direction} ${relation.targetUid}`)])

	describe('sections', () => {
		it('reads all four states of a hierarchy pair, whichever side authored it', () => {
			// Two entries, four possible lines: the same two facts told from either side.
			assert.deepEqual(readings(EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }])), [['subtask-of', 'outgoing p']])
			assert.deepEqual(readings(EntryRelations.of([{ type: RelationType.Child, targetUid: 'c' }])), [['subtasks', 'outgoing c']])
			assert.deepEqual(readings(EntryRelations.of([{ type: RelationType.Parent, targetUid: 'c', direction: 'incoming' as const }])), [['subtasks', 'incoming c']])
			assert.deepEqual(readings(EntryRelations.of([{ type: RelationType.Child, targetUid: 'p', direction: 'incoming' as const }])), [['subtask-of', 'incoming p']])
		})

		it('reads a dependency from both ends: what blocks us, and what we block', () => {
			assert.deepEqual(readings(EntryRelations.of([{ type: RelationType.FinishToStart, targetUid: 'p' }])), [['blocked-by', 'outgoing p']])
			assert.deepEqual(readings(EntryRelations.of([{ type: RelationType.FinishToStart, targetUid: 'd', direction: 'incoming' as const }])), [['blocks', 'incoming d']])
		})

		it('silences the derived echo of a pair a foreign client authored from BOTH sides', () => {
			// We store PARENT → p; p stores CHILD → us. One edge, told twice.
			const bag = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }, { type: RelationType.Child, targetUid: 'p', direction: 'incoming' as const }])
			assert.deepEqual(readings(bag), [['subtask-of', 'outgoing p']])
			// The survivor is the pointer WE own, so removing it edits this entry.
			assert.equal(bag.shown('self')[0]!.isOutgoing, true)
		})

		it('keeps a genuine second line over the same pair: a hierarchy edge and a dependency are not echoes', () => {
			const bag = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }, { type: RelationType.FinishToStart, targetUid: 'p', direction: 'incoming' as const }])
			assert.deepEqual(readings(bag), [['blocks', 'incoming p'], ['subtask-of', 'outgoing p']])
		})

		it('gives an uninterpreted type a section of its own, labelled by its raw value, and trailing', () => {
			const bag = EntryRelations.of([{ type: 'X-WAITS-FOR', targetUid: 'x' }, { type: RelationType.Parent, targetUid: 'p' }])
			assert.deepEqual(bag.sections('self').map(({ section }) => section.value), ['subtask-of', 'X-WAITS-FOR'])
		})

		it('orders sections by rank and owned lines before derived ones within one', () => {
			const bag = EntryRelations.of([
				{ type: RelationType.Child, targetUid: 'owned' },
				{ type: RelationType.FinishToStart, targetUid: 'blocker' },
				{ type: RelationType.Parent, targetUid: 'derived', direction: 'incoming' as const },
			])
			assert.deepEqual(readings(bag), [
				['blocked-by', 'outgoing blocker'],
				['subtasks', 'outgoing owned', 'incoming derived'],
			])
			assert.equal(RelationSection.Subtasks.rank > RelationSection.BlockedBy.rank, true)
		})
	})

	describe('writes', () => {
		it('is the persisting projection alone: a derived line is never in it', () => {
			const bag = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }, { type: RelationType.FinishToStart, targetUid: 'd', direction: 'incoming' as const }])
			assert.deepEqual(bag.writes.map(relation => [relation.type.value, relation.targetUid]), [['PARENT', 'p']])
		})
	})

	describe('the entries at the other ends', () => {
		const entry = (uid: string, relations: Array<RelationInit> = []) => {
			const created = new Entry({ id: uid, sourceId: 's', uid, type: EntryType.Task, heading: uid })
			created.relations = EntryRelations.of(relations)
			return created
		}

		it('links each reached entry once, inside the line that first reaches it, and never one it was asked for', () => {
			const asked = entry('asked', [{ type: RelationType.Parent, targetUid: 'parent' }])
			const parent = entry('parent', [{ type: RelationType.Parent, targetUid: 'asked', direction: 'incoming' as const }, { type: RelationType.Parent, targetUid: 'sibling', direction: 'incoming' as const }])
			const sibling = entry('sibling', [{ type: RelationType.Parent, targetUid: 'parent' }])
			const byUid = new Map([asked, parent, sibling].map(each => [each.uid, each]))
			EntryRelations.link([asked], uid => byUid.get(uid))

			assert.equal(asked.relations!.all[0]!.target, parent)
			assert.deepEqual(parent.relations!.all.map(relation => relation.target?.uid), [undefined, 'sibling'])
			assert.equal(sibling.relations!.all[0]!.target, undefined)
			// So the read serializes, its graph a tree.
			assert.ok(JSON.stringify(asked).includes('"heading":"sibling"'))
		})

		it('compares and keys a line without its target, which only a read carries', () => {
			const bare = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }])
			const linked = bare.targeting(() => entry('p'))
			assert.equal(linked.all[0]!.target?.uid, 'p')
			assert.ok(linked.equals(bare))
		})

		it('writes the owned lines alone, without the entries a read linked in', () => {
			const bag = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }, { type: RelationType.FinishToStart, targetUid: 'd', direction: 'incoming' as const }])
				.targeting(relation => entry(relation.targetUid))
			const written = JSON.parse(JSON.stringify(EntryRelations.writeConverter.deconstruct!(bag, {}))) as Array<Record<string, unknown>>
			assert.deepEqual(written.map(relation => [relation.type, relation.targetUid, relation.direction, relation.target]), [['PARENT', 'p', 'outgoing', undefined]])
		})
	})

	describe('as an entry holds it', () => {
		it('tells none from unknown: an empty collection is a value, absence is not', () => {
			assert.equal(EntryRelations.of().isEmpty, true)
			assert.equal(EntryRelations.converter.construct!(undefined, {}), undefined)
			assert.equal(EntryRelations.converter.construct!(null, {})!.isEmpty, true)
		})

		it('reads null from a request as none, and keeps only the relations it owns', () => {
			assert.equal(EntryRelations.parse(null), EntryRelations.none)
			assert.equal(EntryRelations.parse(undefined), undefined)
			assert.equal(EntryRelations.parse('parent'), EntryRelations.invalid)
			const parsed = EntryRelations.parse([{ type: 'PARENT', targetUid: 'p' }, { type: 'CHILD', targetUid: 'c', direction: 'incoming' }]) as EntryRelations
			assert.deepEqual(parsed.all.map(relation => relation.targetUid), ['p'])
		})

		it('shows its lines from whichever uid asks, as the uid of an entry may change after its relations arrive', () => {
			const bag = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }])
			assert.deepEqual(bag.edges('first').map(edge => edge.key), ['hierarchy p first'])
			assert.deepEqual(bag.edges('second').map(edge => edge.key), ['hierarchy p second'])
			assert.deepEqual(bag.edges(undefined), [])
		})
	})

	describe('adding / without', () => {
		it('answers a NEW collection and leaves the derived half alone', () => {
			const bag = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'c', direction: 'incoming' as const }])
			const grown = bag.adding(RelationType.FinishToStart, 'p', 'self')
			assert.equal(bag.writes.length, 0)
			assert.deepEqual(grown.writes.map(relation => relation.targetUid), ['p'])
			assert.equal(grown.shown('self').filter(relation => !relation.isOutgoing).length, 1)
		})

		it('ignores a self-reference, which states nothing', () => {
			const bag = EntryRelations.of()
			assert.equal(bag.adding(RelationType.Parent, 'self', 'self'), bag)
		})

		it('removes by value and leaves the rest', () => {
			const bag = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }, { type: RelationType.FinishToStart, targetUid: 'b' }])
			const shrunk = bag.without(new Relation({ type: RelationType.Parent, targetUid: 'p' }))
			assert.deepEqual(shrunk.writes.map(relation => relation.targetUid), ['b'])
		})
	})

	describe('edges', () => {
		it('resolves both directions into edges and deduplicates the echo', () => {
			const bag = EntryRelations.of([{ type: RelationType.Parent, targetUid: 'p' }, { type: RelationType.Child, targetUid: 'p', direction: 'incoming' as const }])
			assert.deepEqual(bag.edges('self').map(edge => edge.key), ['hierarchy p self'])
		})

		it('leaves an uninterpreted line out, since it constrains nothing', () => {
			assert.deepEqual(EntryRelations.of([{ type: 'X-WAITS-FOR', targetUid: 'x' }]).edges('self'), [])
		})
	})
})
