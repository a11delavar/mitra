import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Entry, EntryType, TaskStatus } from '#features/entries'
import { RelationGraph } from './RelationGraph.js'
import { EntryRelations } from './EntryRelations.js'
import { RelationType } from './RelationType.js'
import { EntryHierarchy } from './EntryHierarchy.js'

describe('EntryHierarchy', () => {
	const task = (uid: string, init?: Partial<Entry>) => new Entry({ id: uid, uid, type: EntryType.Task, heading: uid, ...init })
	const parent = task('parent')
	const finished = task('finished', { status: TaskStatus.Done, relations: EntryRelations.of([{ type: RelationType.Parent, targetUid: 'parent' }]) })
	const pending = task('pending', { relations: EntryRelations.of([{ type: RelationType.Parent, targetUid: 'parent' }]) })

	afterEach(() => EntryHierarchy.from(() => RelationGraph.empty))

	it('stands alone where no graph is registered, as on the server', () => {
		assert.deepEqual(parent.hierarchy.children, [])
		assert.equal(parent.hierarchy.progress, undefined)
	})

	it('reads its subtasks, its parents and their progress off the registered graph', () => {
		EntryHierarchy.from(() => RelationGraph.of([parent, finished, pending]))
		assert.deepEqual(parent.hierarchy.children.map(child => child.uid), ['finished', 'pending'])
		assert.deepEqual(pending.hierarchy.parents.map(entry => entry.uid), ['parent'])
		assert.equal(parent.hierarchy.progress, 0.5)
		assert.equal(pending.hierarchy.progress, undefined, 'a task without subtasks has only its own progress')
	})
})
