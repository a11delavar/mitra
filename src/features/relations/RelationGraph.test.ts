import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, TaskStatus, EntryType } from '#features/entries'
import type { RelationInit } from './Relation.js'
import { EntryRelations } from './EntryRelations.js'
import { RelationGraph } from './RelationGraph.js'
import { RelationType } from './RelationType.js'

describe('RelationGraph', () => {
	const entry = (uid: string, relations: Array<RelationInit> = [], init: Partial<Entry> = {}) => {
		const created = new Entry({ id: uid, sourceId: 's', uid, type: EntryType.Task, heading: uid, ...init })
		created.relations = EntryRelations.of(relations)
		return created
	}
	const uids = (entries: Array<Entry>) => entries.map(found => found.uid).sort()

	describe('connectedTo', () => {
		it('reaches every entry a chain of edges joins, whichever way each points, and nothing apart from them', () => {
			const graph = RelationGraph.of([
				entry('grandchild', [{ type: RelationType.Parent, targetUid: 'child' }]),
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
				entry('sibling', [{ type: RelationType.Parent, targetUid: 'parent' }]),
				entry('parent'),
				entry('blocked', [{ type: RelationType.FinishToStart, targetUid: 'sibling' }]),
				entry('apart', [{ type: RelationType.Parent, targetUid: 'elsewhere' }]),
				entry('elsewhere'),
			])
			assert.deepEqual(uids(graph.getConnected(['grandchild'])), ['blocked', 'child', 'grandchild', 'parent', 'sibling'])
		})

		it('ends on a cycle', () => {
			const graph = RelationGraph.of([entry('a', [{ type: RelationType.Child, targetUid: 'b' }]), entry('b', [{ type: RelationType.Child, targetUid: 'a' }])])
			assert.deepEqual(uids(graph.getConnected(['a'])), ['a', 'b'])
		})
	})

	describe('edges', () => {
		it('is ONE edge when a pair is authored from both sides', () => {
			const graph = RelationGraph.of([
				entry('parent', [{ type: RelationType.Child, targetUid: 'child' }]),
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
			])
			assert.deepEqual(graph.edges.map(edge => edge.key), ['hierarchy parent child'])
			assert.deepEqual(uids(graph.getChildren('parent')), ['child'])
			assert.deepEqual(uids(graph.getParents('child')), ['parent'])
		})

		it('reads a foreign CHILD line as a real edge, so the parent is found from the child too', () => {
			const graph = RelationGraph.of([entry('parent', [{ type: RelationType.Child, targetUid: 'child' }]), entry('child')])
			assert.deepEqual(uids(graph.getParents('child')), ['parent'])
		})

		it('keeps the families apart: an entry may be both a subtask of and blocked by the same entry', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }, { type: RelationType.FinishToStart, targetUid: 'b' }]),
				entry('b'),
			])
			assert.deepEqual(uids(graph.getParents('a')), ['b'])
			assert.deepEqual(uids(graph.getPredecessors('a')), ['b'])
			assert.deepEqual(uids(graph.getDependents('b')), ['a'])
			assert.deepEqual(uids(graph.getChildren('b')), ['a'])
		})

		it('reads a DERIVED line from the far end: the owner is the target, not this entry', () => {
			// What a read path attaches to the parent: "a stores PARENT → me". Read as if the parent
			// stored it, the edge would point the wrong way and every rollup beneath it would be wrong.
			const graph = RelationGraph.of([
				entry('parent', [{ type: RelationType.Parent, targetUid: 'child', direction: 'incoming' }]),
				entry('child'),
			])
			assert.deepEqual(graph.edges.map(edge => edge.key), ['hierarchy parent child'])
			assert.deepEqual(uids(graph.getChildren('parent')), ['child'])
			assert.deepEqual(graph.getChildren('child'), [])
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
			const occurrence = (id: string, day: number) => entry('series', [{ type: RelationType.FinishToStart, targetUid: 'p' }], { id, recurringEntryId: 'series', recurrenceId: new DateTime(), start: new DateTime(2026, 0, day) })
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
			assert.deepEqual(uids(chain().getDescendants('root')), ['a', 'b'])
			assert.deepEqual(uids(chain().getAncestors('b')), ['a', 'root'])
		})

		it('counts a diamond node once', () => {
			const graph = RelationGraph.of([
				entry('root'),
				entry('left', [{ type: RelationType.Parent, targetUid: 'root' }]),
				entry('right', [{ type: RelationType.Parent, targetUid: 'root' }]),
				entry('join', [{ type: RelationType.Parent, targetUid: 'left' }, { type: RelationType.Parent, targetUid: 'right' }]),
			])
			assert.deepEqual(uids(graph.getDescendants('root')), ['join', 'left', 'right'])
		})

		it('terminates on a cycle no validator ever saw, and never reports the entry as its own descendant', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }]),
				entry('b', [{ type: RelationType.Parent, targetUid: 'a' }]),
			])
			assert.deepEqual(uids(graph.getDescendants('a')), ['b'])
		})

		it('walks dependents transitively, which is what shift propagation will read', () => {
			const graph = RelationGraph.of([
				entry('first'),
				entry('second', [{ type: RelationType.FinishToStart, targetUid: 'first' }]),
				entry('third', [{ type: RelationType.FinishToStart, targetUid: 'second' }]),
			])
			assert.deepEqual(uids(graph.getDownstream('first')), ['second', 'third'])
		})

		it('lets a pointer dangle: an edge to an entry nobody loaded leads nowhere', () => {
			const graph = RelationGraph.of([entry('a', [{ type: RelationType.Parent, targetUid: 'absent' }])])
			assert.deepEqual(graph.getParents('a'), [])
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
			// "grandparent becomes a child of child": walking up from child arrives at grandparent.
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

		it('answers undefined (not 0%) for an entry with no children', () => {
			assert.equal(RelationGraph.of([entry('lonely')]).getRollup('lonely'), undefined)
		})

		it('counts done over total, with cancelled work out of the denominator', () => {
			const rollup = parentOf(childOf('a', { status: TaskStatus.Done }), childOf('b'), childOf('c', { status: TaskStatus.Cancelled })).getRollup('parent')
			assert.deepEqual([rollup!.done, rollup!.total, rollup!.children], [1, 2, 3])
		})

		it('groups an event child but never counts it, since an event has no status', () => {
			const rollup = parentOf(childOf('a', { status: TaskStatus.Done }), childOf('e', { type: EntryType.Event, start: new DateTime() })).getRollup('parent')
			assert.deepEqual([rollup!.done, rollup!.total, rollup!.children], [1, 1, 2])
		})

		it('weights each child by its OWN progress: authored, or its own rollup', () => {
			const authored = parentOf(childOf('a', { status: TaskStatus.Done }), childOf('b', { percentComplete: 50 })).getRollup('parent')
			assert.equal(authored!.progress, 0.75)

			// A grandchild half-done moves its parent's number, which moves the grandparent's.
			const nested = RelationGraph.of([
				entry('parent'),
				childOf('mid'),
				entry('leaf', [{ type: RelationType.Parent, targetUid: 'mid' }], { percentComplete: 50 }),
			])
			assert.equal(nested.getRollup('parent')!.progress, 0.5)
		})

		it('counts the whole subtree as descendants, resolvable ones only', () => {
			const graph = RelationGraph.of([
				entry('parent'),
				childOf('mid'),
				entry('leaf', [{ type: RelationType.Parent, targetUid: 'mid' }]),
				entry('stray', [{ type: RelationType.Parent, targetUid: 'absent' }]),
			])
			assert.deepEqual([graph.getRollup('parent')!.children, graph.getRollup('parent')!.descendants], [1, 2])
		})

		it('survives a cycle rather than recursing forever', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }]),
				entry('b', [{ type: RelationType.Parent, targetUid: 'a' }]),
			])
			assert.equal(graph.getRollup('a')!.total, 1)
		})

		describe('with a checklist in the description', () => {
			const boxes = '- [x] one\n- [ ] two\n- [ ] three'

			it('counts the boxes of an entry that parents nothing at all', () => {
				const rollup = RelationGraph.of([entry('lonely', [], { description: boxes })]).getRollup('lonely')
				assert.deepEqual([rollup!.done, rollup!.total, rollup!.progress], [1, 3, 1 / 3])
				assert.deepEqual([rollup!.subtasks.total, rollup!.checklist.total], [0, 3])
			})

			it('adds them to the subtasks rather than averaging the two sides', () => {
				const graph = RelationGraph.of([
					entry('parent', [], { description: boxes }),
					childOf('a', { status: TaskStatus.Done }),
					childOf('b'),
				])
				const rollup = graph.getRollup('parent')
				assert.deepEqual([rollup!.done, rollup!.total, rollup!.progress], [2, 5, 0.4])
				assert.deepEqual([rollup!.subtasks, rollup!.checklist], [{ done: 1, total: 2 }, { done: 1, total: 3 }])
			})

			it('weights a subtask by its own boxes, the way it weights one by its own subtasks', () => {
				const graph = RelationGraph.of([entry('parent'), childOf('a', { description: '- [x] one\n- [ ] two' })])
				assert.equal(graph.getRollup('parent')!.progress, 0.5)
			})

			it('leaves an event\'s boxes out, since an event has no progress to state', () => {
				const graph = RelationGraph.of([entry('e', [], { type: EntryType.Event, start: new DateTime(), description: boxes })])
				assert.equal(graph.getRollup('e'), undefined)
			})
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

		it('carries a closure ALL the way up, deepest first, not one generation at a time', () => {
			// The very case that shipped broken: closing the last grandchild completes child3, which
			// completes the parent, and only child3 was ever offered.
			assert.deepEqual(chainGraph().getAncestorsCompletedBy('grand2').map(found => found.uid), ['child3', 'parent'])
		})

		it('stops at an ancestor that still has outstanding work of its own', () => {
			const graph = RelationGraph.of([
				entry('parent'),
				entry('open', [{ type: RelationType.Parent, targetUid: 'parent' }]),
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
				entry('grand', [{ type: RelationType.Parent, targetUid: 'child' }], done),
			])
			assert.deepEqual(graph.getAncestorsCompletedBy('grand').map(found => found.uid), ['child'])
		})

		it('leaves cancelled siblings out of the reckoning, as the rollup does', () => {
			const graph = RelationGraph.of([
				entry('parent'),
				entry('cancelled', [{ type: RelationType.Parent, targetUid: 'parent' }], { status: TaskStatus.Cancelled }),
				entry('last', [{ type: RelationType.Parent, targetUid: 'parent' }], done),
			])
			assert.deepEqual(graph.getAncestorsCompletedBy('last').map(found => found.uid), ['parent'])
		})

		it('never offers an ancestor that is already closed, nor an event', () => {
			const graph = RelationGraph.of([
				entry('closed', [], done),
				entry('event', [], { type: EntryType.Event, start: new DateTime() }),
				entry('child', [{ type: RelationType.Parent, targetUid: 'closed' }, { type: RelationType.Parent, targetUid: 'event' }], done),
			])
			assert.deepEqual(graph.getAncestorsCompletedBy('child'), [])
		})

		it('terminates on a cycle rather than climbing forever', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }], done),
				entry('b', [{ type: RelationType.Parent, targetUid: 'a' }], done),
			])
			assert.equal(graph.getAncestorsCompletedBy('a').length <= 2, true)
		})

		it('holds back an ancestor with a box of its own still open', () => {
			const parentWith = (description: string) => RelationGraph.of([
				entry('parent', [], { description }),
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }], done),
			]).getAncestorsCompletedBy('child').map(found => found.uid)
			assert.deepEqual(parentWith('- [ ] Still to do'), [])
			assert.deepEqual(parentWith('- [x] All ticked'), ['parent'])
		})
	})

	describe('one node per uid', () => {
		it('lets the master stand for the series where both are loaded', () => {
			const master = entry('series', [{ type: RelationType.Parent, targetUid: 'parent' }])
			const occurrence = entry('series', [{ type: RelationType.Parent, targetUid: 'parent' }], { id: 'occurrence', recurringEntryId: 'series', recurrenceId: new DateTime() })
			const graph = RelationGraph.of([master, occurrence, entry('parent')])
			assert.deepEqual(graph.getChildren('parent'), [master])
		})

		it('still counts an occurrence whose master the caller did not load, since it carries the series lines', () => {
			const occurrence = entry('series', [{ type: RelationType.Parent, targetUid: 'parent' }], { id: 'occurrence', recurringEntryId: 'series', recurrenceId: new DateTime() })
			const graph = RelationGraph.of([occurrence, entry('parent')])
			assert.deepEqual(graph.getChildren('parent'), [occurrence])
		})
	})

	describe('attach', () => {
		const lines = (served: Entry) => served.relations?.all.map(relation => [relation.direction, relation.type.value, relation.targetUid])
		const fresh = (uid: string, like: Partial<Entry> = {}) => new Entry({ id: uid, sourceId: 's', uid, type: EntryType.Task, heading: uid, status: like.status, recurringEntryId: like.recurringEntryId, recurrenceId: like.recurrenceId, ...like.id ? { id: like.id } : {} })

		it('gives an entry its own lines, and the lines pointing at it as incoming ones naming their owner', () => {
			const graph = RelationGraph.of([entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]), entry('parent')])
			const [child, parent] = [fresh('child'), fresh('parent')]
			graph.attach([child, parent])
			assert.deepEqual(lines(child), [['outgoing', 'PARENT', 'parent']])
			assert.deepEqual(lines(parent), [['incoming', 'PARENT', 'child']])
		})

		it('keeps a pair authored from both sides as two lines, the own one and the incoming one', () => {
			const graph = RelationGraph.of([
				entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]),
				entry('parent', [{ type: RelationType.Child, targetUid: 'child' }]),
			])
			const child = fresh('child')
			graph.attach([child])
			assert.deepEqual(lines(child), [['outgoing', 'PARENT', 'parent'], ['incoming', 'CHILD', 'parent']])
		})

		it('gives an override the relations of its recurring entry', () => {
			const graph = RelationGraph.of([entry('series', [{ type: RelationType.Parent, targetUid: 'parent' }]), entry('parent')])
			const override = fresh('series', { id: 'override', recurringEntryId: 'series', recurrenceId: new DateTime() })
			graph.attach([override])
			assert.deepEqual(lines(override), [['outgoing', 'PARENT', 'parent']])
		})

		it('leaves an entry no line names with none, which is known rather than unknown', () => {
			const graph = RelationGraph.of([entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]), entry('parent')])
			const apart = fresh('apart')
			graph.attach([apart])
			assert.equal(apart.relations?.isEmpty, true)
		})

		it('links the far end of each line in, given its own lines, so the editor needs no second request', () => {
			const graph = RelationGraph.of([entry('child', [{ type: RelationType.Parent, targetUid: 'parent' }]), entry('parent')])
			const child = fresh('child')
			graph.attach([child])
			const parent = child.relations!.all[0]!.target!
			assert.equal(parent.uid, 'parent')
			assert.deepEqual(lines(parent), [['incoming', 'PARENT', 'child']])
		})

		describe('what a read serves, as the browser rebuilds it', () => {
			/** The graph the browser builds from fresh copies of `uids` served by `graph`. */
			const served = (graph: RelationGraph, ...uids: Array<string>) => {
				const copies = uids.map(uid => fresh(uid, graph.getEntry(uid)))
				graph.attach(copies)
				return RelationGraph.of(copies)
			}
			const childOf = (uid: string, parent = 'parent', init: Partial<Entry> = {}) => entry(uid, [{ type: RelationType.Parent, targetUid: parent }], init)

			it('rolls the parent up from the children that point at it, though only the parent was served', () => {
				const graph = RelationGraph.of([entry('parent'), childOf('a', 'parent', { status: TaskStatus.Done }), childOf('b')])
				assert.deepEqual(served(graph, 'parent').getRollup('parent'), { done: 1, total: 2, progress: 0.5, subtasks: { done: 1, total: 2 }, checklist: { done: 0, total: 0 }, children: 2, descendants: 2 })
			})

			it('counts a foreign-authored CHILD line the same as a PARENT one, and a pair authored from both sides once', () => {
				const foreign = RelationGraph.of([entry('parent', [{ type: RelationType.Child, targetUid: 'a' }]), entry('a', [], { status: TaskStatus.Done })])
				assert.deepEqual(served(foreign, 'parent').getRollup('parent')!.subtasks, { done: 1, total: 1 })
				const both = RelationGraph.of([entry('parent', [{ type: RelationType.Child, targetUid: 'a' }]), childOf('a')])
				assert.deepEqual(served(both, 'parent').getRollup('parent')!.subtasks, { done: 0, total: 1 })
			})

			it('reaches the whole subtree beneath a served entry, and its parents with their own rollups', () => {
				const graph = RelationGraph.of([entry('parent'), childOf('a', 'parent', { status: TaskStatus.Done }), childOf('b', 'a')])
				const fromParent = served(graph, 'parent')
				assert.deepEqual(uids(fromParent.getDescendants('parent')), ['a', 'b'])
				assert.deepEqual(fromParent.getRollup('parent')!.descendants, 2)
				const fromChild = served(graph, 'a')
				assert.deepEqual(uids(fromChild.getParents('a')), ['parent'])
				assert.deepEqual(fromChild.getRollup('parent')!.subtasks, { done: 1, total: 1 })
			})

			it('reaches however far and whichever way the lines point, and nothing apart from them', () => {
				const graph = RelationGraph.of([
					entry('parent'), childOf('a'), childOf('b', 'a'), childOf('c'),
					entry('d', [{ type: RelationType.FinishToStart, targetUid: 'c' }]),
					entry('unrelated'), entry('apart', [{ type: RelationType.Parent, targetUid: 'elsewhere' }]), entry('elsewhere'),
				])
				assert.deepEqual(uids([...served(graph, 'b').entries]), ['a', 'b', 'c', 'd', 'parent'])
			})

			it('ends on a cycle, and ignores a dangling pointer rather than counting a phantom child', () => {
				const cyclic = RelationGraph.of([entry('a', [{ type: RelationType.Child, targetUid: 'b' }]), entry('b', [{ type: RelationType.Child, targetUid: 'a' }])])
				assert.deepEqual([served(cyclic, 'a').getRollup('a')!.descendants, served(cyclic, 'a').getRollup('b')!.descendants], [1, 1])
				const dangling = RelationGraph.of([entry('parent', [{ type: RelationType.Child, targetUid: 'never-synced' }])])
				assert.equal(served(dangling, 'parent').getRollup('parent'), undefined)
			})
		})
	})

	describe('replacing', () => {
		it('holds the candidate lines in place of the stored ones: a write replaces what the entry holds today', () => {
			const graph = RelationGraph.of([entry('entry', [{ type: RelationType.Child, targetUid: 'f' }]), entry('f')])
			const replaced = graph.replacing(graph.getEntry('entry')!, EntryRelations.of([{ type: RelationType.Parent, targetUid: 'f' }]))
			assert.deepEqual(uids(replaced.getParents('entry')), ['f'])
			assert.deepEqual(replaced.getChildren('entry'), [])
		})

		it('takes in an entry the graph does not hold yet', () => {
			const graph = RelationGraph.of([entry('f')])
			const replaced = graph.replacing(entry('fresh'), EntryRelations.of([{ type: RelationType.Parent, targetUid: 'f' }]))
			assert.deepEqual(uids(replaced.getParents('fresh')), ['f'])
		})

		it('leaves the lines of every other entry in place, those pointing at the entry included', () => {
			const graph = RelationGraph.of([
				entry('a', [{ type: RelationType.Parent, targetUid: 'b' }]),
				entry('b'),
				entry('c', [{ type: RelationType.Parent, targetUid: 'a' }]),
			])
			const replaced = graph.replacing(graph.getEntry('a')!, EntryRelations.none)
			assert.deepEqual(replaced.getParents('a'), [])
			assert.deepEqual(uids(replaced.getChildren('a')), ['c'])
			assert.deepEqual(uids(graph.getParents('a')), ['b'])
		})
	})
})
