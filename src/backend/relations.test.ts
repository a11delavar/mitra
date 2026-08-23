import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Source, Entry, EntryRelation, EntryType, Recurrence, EntryRelations, RelationGraph, RelationType, TaskStatus } from '../shared/index.js'
import { Dev } from './Dev.js'
import { NotificationSubscription } from './NotificationSubscription.js'
import { Session } from './Session.js'
import { assertRelationsValid, relationClosure } from './relations.js'

// Tests derivation of hierarchy rollups and graph cycle handling.

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Dev, Source, Entry, EntryRelation, Recurrence, NotificationSubscription, Session],
		dbName: ':memory:',
		namingStrategy: class extends UnderscoreNamingStrategy {
			override joinColumnName(propertyName: string) {
				return this.propertyToColumnName(propertyName)
			}

			override joinKeyColumnName(entityName: string) {
				return this.propertyToColumnName(entityName)
			}
		},
		allowGlobalContext: true,
	})
	await orm.schema.update()
	return orm
}

describe('hierarchy rollup', () => {
	let orm: MikroORM
	let em: EntityManager
	let user: User
	let source: Source

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	beforeEach(async () => {
		em = orm.em.fork()
		await em.nativeDelete(EntryRelation, {})
		await em.nativeDelete(Entry, {})
		await em.nativeDelete(Source, {})
		await em.nativeDelete(Integration, {})
		await em.nativeDelete(User, {})
		user = new User({ username: 'owner' })
		const integration = new Dev({ userId: user.id, uri: 'dev://owner' })
		source = new Source({ integrationId: integration.id, uri: 'owner/calendar', entryTypes: [EntryType.Event, EntryType.Task], name: 'Calendar', enabled: true, hidden: false })
		em.persist([user, integration, source])
		await em.flush()
	})

	/** One task on the user's source, identified by a stable uid so relations can target it. */
	async function task(uid: string, status?: TaskStatus, type = EntryType.Task) {
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uid, type, heading: uid, status })
		em.persist(entry)
		await em.flush()
		return entry
	}

	/** Builds RelationGraph from relationClosure response. */
	const closureGraph = async () => RelationGraph.of(await relationClosure(em, user))

	async function relate(owner: Entry, type: RelationType, targetUid: string) {
		em.persist(new EntryRelation({ entryId: owner.id!, type, targetUid }))
		await em.flush()
	}

	it('counts the children that point at the parent with PARENT — mitra\'s own direction', async () => {
		await task('parent')
		const first = await task('a', TaskStatus.Done)
		const second = await task('b', TaskStatus.ToDo)
		await relate(first, RelationType.Parent, 'parent')
		await relate(second, RelationType.Parent, 'parent')

		const graph = await closureGraph()
		assert.deepEqual(graph.rollupOf('parent'), { done: 1, total: 2, progress: 0.5, children: 2, descendants: 2 })
	})

	it('counts a foreign-authored CHILD row the same as a PARENT one', async () => {
		const parent = await task('parent')
		await task('a', TaskStatus.Done)
		await relate(parent, RelationType.Child, 'a')

		const graph = await closureGraph()
		assert.deepEqual(graph.rollupOf('parent'), { done: 1, total: 1, progress: 1, children: 1, descendants: 1 })
	})

	it('deduplicates an edge authored redundantly from both sides', async () => {
		const parent = await task('parent')
		const child = await task('a', TaskStatus.ToDo)
		await relate(child, RelationType.Parent, 'parent')
		await relate(parent, RelationType.Child, 'a')

		const graph = await closureGraph()
		assert.deepEqual(graph.rollupOf('parent'), { done: 0, total: 1, progress: 0, children: 1, descendants: 1 })
	})

	it('drops a cancelled child from the denominator but still counts it as a child', async () => {
		await task('parent')
		const done = await task('a', TaskStatus.Done)
		const cancelled = await task('b', TaskStatus.Cancelled)
		await relate(done, RelationType.Parent, 'parent')
		await relate(cancelled, RelationType.Parent, 'parent')

		const graph = await closureGraph()
		assert.deepEqual(graph.rollupOf('parent'), { done: 1, total: 1, progress: 1, children: 2, descendants: 2 })
	})

	it('leaves an event child out of the progress counts', async () => {
		await task('parent')
		const event = await task('a', undefined, EntryType.Event)
		const subtask = await task('b', TaskStatus.Done)
		await relate(event, RelationType.Parent, 'parent')
		await relate(subtask, RelationType.Parent, 'parent')

		const graph = await closureGraph()
		assert.deepEqual(graph.rollupOf('parent'), { done: 1, total: 1, progress: 1, children: 2, descendants: 2 })
	})

	it('leaves an entry that parents nothing without a rollup', async () => {
		await task('lonely')
		await task('parent')
		const child = await task('a')
		await relate(child, RelationType.Parent, 'parent')

		const graph = await closureGraph()
		assert.equal(graph.rollupOf('lonely'), undefined)
		assert.ok(graph.rollupOf('parent'))
	})

	it('rolls progress up from direct children only, but counts the whole subtree as descendants', async () => {
		await task('parent')
		const child = await task('a', TaskStatus.Done)
		const grandchild = await task('b', TaskStatus.ToDo)
		await relate(child, RelationType.Parent, 'parent')
		await relate(grandchild, RelationType.Parent, 'a')

		const graph = await closureGraph()
		assert.deepEqual(graph.rollupOf('parent'), { done: 1, total: 1, progress: 1, children: 1, descendants: 2 })
	})

	it('calculates weighted progress when subtasks have custom percentComplete', async () => {
		await task('parent')
		const first = await task('a', TaskStatus.Done)
		const second = await task('b', TaskStatus.Done)
		const third = await task('c', TaskStatus.Doing)
		third.percentComplete = 80
		em.persist(third)
		await em.flush()

		await relate(first, RelationType.Parent, 'parent')
		await relate(second, RelationType.Parent, 'parent')
		await relate(third, RelationType.Parent, 'parent')

		const graph = await closureGraph()
		assert.equal(graph.rollupOf('parent')?.done, 2)
		assert.equal(graph.rollupOf('parent')?.total, 3)
		assert.equal(Math.round((graph.rollupOf('parent')?.progress ?? 0) * 100), 93)
	})

	it('terminates on a cycle instead of walking it forever', async () => {
		const first = await task('a')
		const second = await task('b')
		await relate(first, RelationType.Child, 'b')
		await relate(second, RelationType.Child, 'a')

		const graph = await closureGraph()
		assert.equal(graph.rollupOf('a')?.descendants, 1)
		assert.equal(graph.rollupOf('b')?.descendants, 1)
	})

	it('ignores a dangling pointer rather than counting a phantom child', async () => {
		const parent = await task('parent')
		await relate(parent, RelationType.Child, 'never-synced')

		const graph = await closureGraph()
		assert.equal(graph.rollupOf('parent'), undefined)
	})

	it('never counts a child on a source the user does not own', async () => {
		await task('parent')
		const stranger = new User({ username: 'stranger' })
		const strangerIntegration = new Dev({ userId: stranger.id, uri: 'dev://stranger' })
		const strangerSource = new Source({ integrationId: strangerIntegration.id, uri: 'stranger/calendar', entryTypes: [EntryType.Task], name: 'Theirs', enabled: true, hidden: false })
		const theirTask = new Entry({ id: crypto.randomUUID(), sourceId: strangerSource.id, uid: 'theirs', type: EntryType.Task, heading: 'theirs', status: TaskStatus.Done })
		em.persist([stranger, strangerIntegration, strangerSource, theirTask])
		await em.flush()
		em.persist(new EntryRelation({ entryId: theirTask.id!, type: RelationType.Parent, targetUid: 'parent' }))
		await em.flush()

		const graph = await closureGraph()
		assert.equal(graph.rollupOf('parent'), undefined)
	})

	describe('the closure as a graph', () => {
		it('answers the direct parents, with their own rollups', async () => {
			await task('parent')
			const child = await task('a', TaskStatus.Done)
			await relate(child, RelationType.Parent, 'parent')

			const graph = await closureGraph()
			assert.deepEqual(graph.parentsOf('a').map(found => found.uid), ['parent'])
			assert.deepEqual(graph.rollupOf('parent'), { done: 1, total: 1, progress: 1, children: 1, descendants: 1 })
		})

		it('answers the whole subtree beneath the entry, and never the entry itself', async () => {
			await task('parent')
			const child = await task('a')
			const grandchild = await task('b')
			await relate(child, RelationType.Parent, 'parent')
			await relate(grandchild, RelationType.Parent, 'a')

			const graph = await closureGraph()
			assert.deepEqual(graph.descendantsOf('parent').map(found => found.uid).sort(), ['a', 'b'])
			assert.deepEqual(graph.parentsOf('parent'), [])
		})

		it('names only the entries the graph mentions — an unrelated entry is not in it', async () => {
			await task('parent')
			const child = await task('a')
			await relate(child, RelationType.Parent, 'parent')
			await task('unrelated')

			assert.deepEqual((await relationClosure(em, user)).map(found => found.uid).sort(), ['a', 'parent'])
		})

		it('carries BOTH directions on every entry it serves, so the editor needs no second request', async () => {
			await task('parent')
			const child = await task('a')
			await relate(child, RelationType.Parent, 'parent')

			const closure = await relationClosure(em, user)
			const served = closure.find(found => found.uid === 'parent')!
			assert.deepEqual(served.relations?.map(relation => [relation.direction, relation.type.value, relation.targetUid]), [['incoming', 'PARENT', 'a']])
		})
	})

	describe('what a WRITE path sees', () => {
		it('loadFor yields the entry OWN rows only — a write path can never diff against a derived line', async () => {
			// The structural reason a provider sync cannot churn on the derived half: it never sees one.
			const parent = await task('parent')
			const child = await task('a')
			await relate(child, RelationType.Parent, 'parent')

			await EntryRelation.loadFor(em, [parent, child])
			assert.equal(parent.relations, null)
			assert.deepEqual(child.relations?.map(relation => [relation.direction, relation.targetUid]), [['outgoing', 'parent']])
		})

		it('reconcile ignores a derived line, so omitting one can never delete the other row', async () => {
			const parent = await task('parent')
			const child = await task('a')
			await relate(child, RelationType.Parent, 'parent')

			// The parent is served "a points at me"; PUTting that back must write nothing of its own.
			await EntryRelation.reconcile(em, parent.id!, EntryRelations.of('parent', [{ type: RelationType.Parent, targetUid: 'a', direction: 'incoming' }]).value)
			await em.flush()

			assert.equal(await em.count(EntryRelation, { entryId: parent.id! }), 0)
			assert.equal(await em.count(EntryRelation, { entryId: child.id! }), 1)
		})
	})

	describe('assertRelationsValid', () => {
		const candidates = (...pairs: Array<[RelationType, string]>) => EntryRelations.of(undefined, pairs.map(([type, targetUid]) => ({ type, targetUid }))).value

		it('refuses a relationship to the entry itself, which states nothing', async () => {
			const entry = await task('a')
			assert.match(await assertRelationsValid(em, user, entry, candidates([RelationType.Parent, 'a'])) ?? '', /cannot relate to itself/)
		})

		it('refuses a hierarchy that would close a loop, at any depth', async () => {
			const grandparent = await task('grandparent')
			const parent = await task('parent')
			const child = await task('child')
			await relate(parent, RelationType.Parent, 'grandparent')
			await relate(child, RelationType.Parent, 'parent')

			assert.match(await assertRelationsValid(em, user, grandparent, candidates([RelationType.Parent, 'child'])) ?? '', /circular hierarchy/)
			assert.equal(await assertRelationsValid(em, user, grandparent, candidates([RelationType.FinishToStart, 'child'])), undefined)
		})

		it('refuses a dependency that would close a loop, and keeps the two families apart', async () => {
			const first = await task('first')
			const second = await task('second')
			await relate(second, RelationType.FinishToStart, 'first')

			assert.match(await assertRelationsValid(em, user, first, candidates([RelationType.FinishToStart, 'second'])) ?? '', /circular dependency/)
			assert.equal(await assertRelationsValid(em, user, first, candidates([RelationType.Parent, 'second'])), undefined)
		})

		it('judges the CANDIDATE list, not the stored one — a write replaces what it holds today', async () => {
			// The entry currently claims f as its child (a foreign CHILD line). Re-pointing it as f's
			// child is legal precisely because this write deletes the line that would contradict it.
			const entry = await task('entry')
			await task('f')
			await relate(entry, RelationType.Child, 'f')

			assert.equal(await assertRelationsValid(em, user, entry, candidates([RelationType.Parent, 'f'])), undefined)
		})

		it('does not walk a CHILD-typed candidate, which the editor never authors', async () => {
			await task('parent')
			const child = await task('child')
			await relate(child, RelationType.Parent, 'parent')

			assert.equal(await assertRelationsValid(em, user, child, candidates([RelationType.Child, 'parent'])), undefined)
		})

		it('passes an empty or absent list, and an entry no uid identifies yet', async () => {
			const entry = await task('a')
			assert.equal(await assertRelationsValid(em, user, entry, null), undefined)
			const draft = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'draft' })
			assert.equal(await assertRelationsValid(em, user, draft, candidates([RelationType.Parent, 'a'])), undefined)
		})
	})
})
