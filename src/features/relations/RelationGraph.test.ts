import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, TaskStatus } from '../entries/Entry.js'
import { EntryType } from '../entries/EntryType.js'
import type { RelationInit } from './Relation.js'
import { EntryRelations } from './EntryRelations.js'
import { RelationGraph } from './RelationGraph.js'
import { RelationType } from './RelationType.js'

describe('RelationGraph', () => {
	const entry = (uid: string, relations: Array<RelationInit> = [], init: Partial<Entry> = {}) => {
		const created = new Entry({ id: uid, sourceId: 's', uid, type: EntryType.Task, heading: uid, ...init })
		created.relations = EntryRelations.of(undefined, relations).value
		return created
	}
	const uids = (entries: Array<Entry>) => entries.map(found => found.uid).sort()

	describe('edges', () => {
		it('is ONE edge when a pair is authored from both sides', () => {
			const graph = RelationGraph.of([
				entry('parent', [{ type: RelationType.Child, targetUid: 'child' }]),
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
			])
			assert.deepEqual(graph.edges.map(edge => edge.key), ['hierarchy parent child'])
			assert.deepEqual(uids(graph.childrenOf('parent')), ['child'])
			assert.deepEqual(uids(graph.parentsOf('child')), ['parent'])
		})

		it('reads a foreign CHILD line as a real edge, so the parent is found from the child too', () => {
			const graph = RelationGraph.of([entry('parent', [{ type: RelationType.Child, targetUid: 'child' }]), entry('child')])
			assert.deepEqual(uids(graph.parentsOf('child')), ['parent'])
		})

		it('keeps the families apart — an entry may be both a subtask of and blocked by the same entry', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }, { type: RelationType.FinishToStart, targetUid: 'b' }]),
				entry('b'),
			])
			assert.deepEqual(uids(graph.parentsOf('a')), ['b'])
			assert.deepEqual(uids(graph.predecessorsOf('a')), ['b'])
			assert.deepEqual(uids(graph.dependentsOf('b')), ['a'])
			assert.deepEqual(uids(graph.childrenOf('b')), ['a'])
		})

		it('reads a DERIVED line from the far end — the owner is the target, not this entry', () => {
			// What a read path attaches to the parent: "a stores PARENT → me". Read as if the parent
			// stored it, the edge would point the wrong way and every rollup beneath it would be wrong.
			const graph = RelationGraph.of([
				entry('parent', [{ type: RelationType.Parent, targetUid: 'child', direction: 'incoming' }]),
				entry('child'),
			])
			assert.deepEqual(graph.edges.map(edge => edge.key), ['hierarchy parent child'])
			assert.deepEqual(uids(graph.childrenOf('parent')), ['child'])
			assert.deepEqual(graph.childrenOf('child'), [])
		})

		it('is the same graph whether a pair is described from one side or both', () => {
			const owned = RelationGraph.of([entry('parent'), entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }])])
			const both = RelationGraph.of([
				entry('parent', [{ type: RelationType.Parent, targetUid: 'child', direction: 'incoming' }]),
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
			])
			assert.deepEqual(both.edges.map(edge => edge.key), owned.edges.map(edge => edge.key))
		})

		it('is ONE edge however many occurrences of a recurring owner are rendered', () => {
			// What the connector layer builds from: the chips on screen. Before the edges came from the
			// graph, each occurrence contributed its master's relationship again and the same arrow was
			// drawn several times, exactly on top of itself.
			const occurrence = (id: string, day: number) => entry('series', [{ type: RelationType.FinishToStart, targetUid: 'p' }], { id, recurrenceMasterId: 'series', recurrenceId: new DateTime(), start: new DateTime(2026, 0, day) })
			const graph = RelationGraph.of([entry('p'), occurrence('first', 1), occurrence('second', 8), occurrence('third', 15)])
			assert.deepEqual(graph.edges.map(edge => edge.key), ['dependency p series'])
		})

		it('is ONE edge when a hierarchy pair is authored from both sides AND both chips render', () => {
			// The other way the connector used to draw twice: our PARENT → p and p's own CHILD → us keyed
			// differently, so the layer saw two edges where the graph sees one.
			const graph = RelationGraph.of([
				entry('parent', [{ type: RelationType.Child, targetUid: 'child' }]),
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
			])
			assert.equal(graph.edges.length, 1)
		})

		it('drops a self-edge and ignores an entry with no uid', () => {
			const graph = RelationGraph.of([entry('a', [{ type: RelationType.Parent, targetUid: 'a' }]), new Entry({ id: 'x', sourceId: 's', type: EntryType.Task })])
			assert.deepEqual(graph.edges, [])
		})
	})

	describe('walks', () => {
		const chain = () => RelationGraph.of([
			entry('root'),
			entry('a', [{ type: RelationType.Parent, targetUid: 'root' }]),
			entry('b', [{ type: RelationType.Parent, targetUid: 'a' }]),
		])

		it('answers the whole subtree at any depth, and never the entry itself', () => {
			assert.deepEqual(uids(chain().descendantsOf('root')), ['a', 'b'])
			assert.deepEqual(uids(chain().ancestorsOf('b')), ['a', 'root'])
		})

		it('counts a diamond node once', () => {
			const graph = RelationGraph.of([
				entry('root'),
				entry('left', [{ type: RelationType.Parent, targetUid: 'root' }]),
				entry('right', [{ type: RelationType.Parent, targetUid: 'root' }]),
				entry('join', [{ type: RelationType.Parent, targetUid: 'left' }, { type: RelationType.Parent, targetUid: 'right' }]),
			])
			assert.deepEqual(uids(graph.descendantsOf('root')), ['join', 'left', 'right'])
		})

		it('terminates on a cycle no validator ever saw, and never reports the entry as its own descendant', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }]),
				entry('b', [{ type: RelationType.Parent, targetUid: 'a' }]),
			])
			assert.deepEqual(uids(graph.descendantsOf('a')), ['b'])
		})

		it('walks dependents transitively, which is what shift propagation will read', () => {
			const graph = RelationGraph.of([
				entry('first'),
				entry('second', [{ type: RelationType.FinishToStart, targetUid: 'first' }]),
				entry('third', [{ type: RelationType.FinishToStart, targetUid: 'second' }]),
			])
			assert.deepEqual(uids(graph.downstreamOf('first')), ['second', 'third'])
		})

		it('lets a pointer dangle: an edge to an entry nobody loaded leads nowhere', () => {
			const graph = RelationGraph.of([entry('a', [{ type: RelationType.Parent, targetUid: 'absent' }])])
			assert.deepEqual(graph.parentsOf('a'), [])
			assert.equal(graph.edges.length, 1)
		})
	})

	describe('reaches', () => {
		const graph = () => RelationGraph.of([
			entry('grandparent'),
			entry('parent', [{ type: RelationType.Parent, targetUid: 'grandparent' }]),
			entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
		])

		it('finds the ancestor a candidate edge would close a loop through', () => {
			// "grandparent becomes a child of child" — walking up from child arrives at grandparent.
			assert.equal(graph().reaches('hierarchy', ['child'], 'grandparent'), true)
		})

		it('says no where the two are unrelated, and never crosses families', () => {
			assert.equal(graph().reaches('hierarchy', ['grandparent'], 'child'), false)
			assert.equal(graph().reaches('dependency', ['child'], 'grandparent'), false)
		})
	})

	describe('rollupOf', () => {
		const parentOf = (...children: Array<Entry>) => RelationGraph.of([entry('parent'), ...children])
		const childOf = (uid: string, init: Partial<Entry> = {}) => entry(uid, [{ type: RelationType.Parent, targetUid: 'parent' }], init)

		it('answers undefined — not 0% — for an entry with no children', () => {
			assert.equal(RelationGraph.of([entry('lonely')]).rollupOf('lonely'), undefined)
		})

		it('counts done over total, with cancelled work out of the denominator', () => {
			const rollup = parentOf(childOf('a', { status: TaskStatus.Done }), childOf('b'), childOf('c', { status: TaskStatus.Cancelled })).rollupOf('parent')
			assert.deepEqual([rollup!.done, rollup!.total, rollup!.children], [1, 2, 3])
		})

		it('groups an event child but never counts it — an event has no status', () => {
			const rollup = parentOf(childOf('a', { status: TaskStatus.Done }), childOf('e', { type: EntryType.Event, start: new DateTime() })).rollupOf('parent')
			assert.deepEqual([rollup!.done, rollup!.total, rollup!.children], [1, 1, 2])
		})

		it('weights each child by its OWN progress — authored, or its own rollup', () => {
			const authored = parentOf(childOf('a', { status: TaskStatus.Done }), childOf('b', { percentComplete: 50 })).rollupOf('parent')
			assert.equal(authored!.progress, 0.75)

			// A grandchild half-done moves its parent's number, which moves the grandparent's.
			const nested = RelationGraph.of([
				entry('parent'),
				childOf('mid'),
				entry('leaf', [{ type: RelationType.Parent, targetUid: 'mid' }], { percentComplete: 50 }),
			])
			assert.equal(nested.rollupOf('parent')!.progress, 0.5)
		})

		it('counts the whole subtree as descendants, resolvable ones only', () => {
			const graph = RelationGraph.of([
				entry('parent'),
				childOf('mid'),
				entry('leaf', [{ type: RelationType.Parent, targetUid: 'mid' }]),
				entry('stray', [{ type: RelationType.Parent, targetUid: 'absent' }]),
			])
			assert.deepEqual([graph.rollupOf('parent')!.children, graph.rollupOf('parent')!.descendants], [1, 2])
		})

		it('survives a cycle rather than recursing forever', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }]),
				entry('b', [{ type: RelationType.Parent, targetUid: 'a' }]),
			])
			assert.equal(graph.rollupOf('a')!.total, 1)
		})
	})

	describe('ancestorsCompletedBy', () => {
		const done = { status: TaskStatus.Done }
		const chainGraph = () => RelationGraph.of([
			entry('parent'),
			entry('child1', [{ type: RelationType.Parent, targetUid: 'parent' }], done),
			entry('child2', [{ type: RelationType.Parent, targetUid: 'parent' }], done),
			entry('child3', [{ type: RelationType.Parent, targetUid: 'parent' }]),
			entry('grand1', [{ type: RelationType.Parent, targetUid: 'child3' }], done),
			entry('grand2', [{ type: RelationType.Parent, targetUid: 'child3' }], done),
		])

		it('carries a closure ALL the way up, deepest first — not one generation at a time', () => {
			// The very case that shipped broken: closing the last grandchild completes child3, which
			// completes the parent, and only child3 was ever offered.
			assert.deepEqual(chainGraph().ancestorsCompletedBy('grand2').map(found => found.uid), ['child3', 'parent'])
		})

		it('stops at an ancestor that still has outstanding work of its own', () => {
			const graph = RelationGraph.of([
				entry('parent'),
				entry('open', [{ type: RelationType.Parent, targetUid: 'parent' }]),
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
				entry('grand', [{ type: RelationType.Parent, targetUid: 'child' }], done),
			])
			assert.deepEqual(graph.ancestorsCompletedBy('grand').map(found => found.uid), ['child'])
		})

		it('leaves cancelled siblings out of the reckoning, as the rollup does', () => {
			const graph = RelationGraph.of([
				entry('parent'),
				entry('cancelled', [{ type: RelationType.Parent, targetUid: 'parent' }], { status: TaskStatus.Cancelled }),
				entry('last', [{ type: RelationType.Parent, targetUid: 'parent' }], done),
			])
			assert.deepEqual(graph.ancestorsCompletedBy('last').map(found => found.uid), ['parent'])
		})

		it('never offers an ancestor that is already closed, nor an event', () => {
			const graph = RelationGraph.of([
				entry('closed', [], done),
				entry('event', [], { type: EntryType.Event, start: new DateTime() }),
				entry('child', [{ type: RelationType.Parent, targetUid: 'closed' }, { type: RelationType.Parent, targetUid: 'event' }], done),
			])
			assert.deepEqual(graph.ancestorsCompletedBy('child'), [])
		})

		it('terminates on a cycle rather than climbing forever', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }], done),
				entry('b', [{ type: RelationType.Parent, targetUid: 'a' }], done),
			])
			assert.equal(graph.ancestorsCompletedBy('a').length <= 2, true)
		})
	})

	describe('one node per uid', () => {
		it('lets the master stand for the series where both are loaded', () => {
			const master = entry('series', [{ type: RelationType.Parent, targetUid: 'parent' }])
			const occurrence = entry('series', [{ type: RelationType.Parent, targetUid: 'parent' }], { id: 'occurrence', recurrenceMasterId: 'series', recurrenceId: new DateTime() })
			const graph = RelationGraph.of([master, occurrence, entry('parent')])
			assert.deepEqual(graph.childrenOf('parent'), [master])
		})

		it('still counts an occurrence whose master the caller did not load — it carries the series lines', () => {
			const occurrence = entry('series', [{ type: RelationType.Parent, targetUid: 'parent' }], { id: 'occurrence', recurrenceMasterId: 'series', recurrenceId: new DateTime() })
			const graph = RelationGraph.of([occurrence, entry('parent')])
			assert.deepEqual(graph.childrenOf('parent'), [occurrence])
		})
	})
})
