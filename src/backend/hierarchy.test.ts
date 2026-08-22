import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Source, Entry, EntryRelation, EntryType, Recurrence, RelationType, TaskStatus } from '../shared/index.js'
import { Dev } from './Dev.js'
import { NotificationSubscription } from './NotificationSubscription.js'
import { Session } from './Session.js'
import { attachRollups, resolveHierarchyView } from './hierarchy.js'

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

	/** Stores one outgoing relation row on `owner`, exactly as a write path would. */
	async function relate(owner: Entry, type: RelationType, targetUid: string) {
		em.persist(new EntryRelation({ entryId: owner.id!, type, targetUid }))
		await em.flush()
	}

	it('counts the children that point at the parent with PARENT — mitra\'s own direction', async () => {
		const parent = await task('parent')
		const first = await task('a', TaskStatus.Done)
		const second = await task('b', TaskStatus.ToDo)
		await relate(first, RelationType.Parent, 'parent')
		await relate(second, RelationType.Parent, 'parent')

		await attachRollups(em, user, [parent])
		assert.deepEqual(parent.subtasks, { done: 1, total: 2, progress: 0.5, children: 2, descendants: 2 })
	})

	it('counts a foreign-authored CHILD row the same as a PARENT one', async () => {
		const parent = await task('parent')
		await task('a', TaskStatus.Done)
		await relate(parent, RelationType.Child, 'a')

		await attachRollups(em, user, [parent])
		assert.deepEqual(parent.subtasks, { done: 1, total: 1, progress: 1, children: 1, descendants: 1 })
	})

	it('deduplicates an edge authored redundantly from both sides', async () => {
		const parent = await task('parent')
		const child = await task('a', TaskStatus.ToDo)
		await relate(child, RelationType.Parent, 'parent')
		await relate(parent, RelationType.Child, 'a')

		await attachRollups(em, user, [parent])
		assert.deepEqual(parent.subtasks, { done: 0, total: 1, progress: 0, children: 1, descendants: 1 })
	})

	it('drops a cancelled child from the denominator but still counts it as a child', async () => {
		const parent = await task('parent')
		const done = await task('a', TaskStatus.Done)
		const cancelled = await task('b', TaskStatus.Cancelled)
		await relate(done, RelationType.Parent, 'parent')
		await relate(cancelled, RelationType.Parent, 'parent')

		await attachRollups(em, user, [parent])
		assert.deepEqual(parent.subtasks, { done: 1, total: 1, progress: 1, children: 2, descendants: 2 })
	})

	it('leaves an event child out of the progress counts', async () => {
		const parent = await task('parent')
		const event = await task('a', undefined, EntryType.Event)
		const subtask = await task('b', TaskStatus.Done)
		await relate(event, RelationType.Parent, 'parent')
		await relate(subtask, RelationType.Parent, 'parent')

		await attachRollups(em, user, [parent])
		assert.deepEqual(parent.subtasks, { done: 1, total: 1, progress: 1, children: 2, descendants: 2 })
	})

	it('leaves an entry that parents nothing without a rollup', async () => {
		const lonely = await task('lonely')
		const parent = await task('parent')
		const child = await task('a')
		await relate(child, RelationType.Parent, 'parent')

		await attachRollups(em, user, [lonely, parent])
		assert.equal(lonely.subtasks, undefined)
		assert.ok(parent.subtasks)
	})

	it('rolls progress up from direct children only, but counts the whole subtree as descendants', async () => {
		const parent = await task('parent')
		const child = await task('a', TaskStatus.Done)
		const grandchild = await task('b', TaskStatus.ToDo)
		await relate(child, RelationType.Parent, 'parent')
		await relate(grandchild, RelationType.Parent, 'a')

		await attachRollups(em, user, [parent])
		assert.deepEqual(parent.subtasks, { done: 1, total: 1, progress: 1, children: 1, descendants: 2 })
	})

	it('calculates weighted progress when subtasks have custom percentComplete', async () => {
		const parent = await task('parent')
		const first = await task('a', TaskStatus.Done)
		const second = await task('b', TaskStatus.Done)
		const third = await task('c', TaskStatus.Doing)
		third.percentComplete = 80
		em.persist(third)
		await em.flush()

		await relate(first, RelationType.Parent, 'parent')
		await relate(second, RelationType.Parent, 'parent')
		await relate(third, RelationType.Parent, 'parent')

		await attachRollups(em, user, [parent])
		assert.equal(parent.subtasks?.done, 2)
		assert.equal(parent.subtasks?.total, 3)
		assert.equal(Math.round((parent.subtasks?.progress ?? 0) * 100), 93)
	})

	it('terminates on a cycle instead of walking it forever', async () => {
		const first = await task('a')
		const second = await task('b')
		await relate(first, RelationType.Child, 'b')
		await relate(second, RelationType.Child, 'a')

		await attachRollups(em, user, [first, second])
		assert.equal(first.subtasks?.descendants, 1)
		assert.equal(second.subtasks?.descendants, 1)
	})

	it('ignores a dangling pointer rather than counting a phantom child', async () => {
		const parent = await task('parent')
		await relate(parent, RelationType.Child, 'never-synced')

		await attachRollups(em, user, [parent])
		assert.equal(parent.subtasks, undefined)
	})

	it('never counts a child on a source the user does not own', async () => {
		const parent = await task('parent')
		const stranger = new User({ username: 'stranger' })
		const strangerIntegration = new Dev({ userId: stranger.id, uri: 'dev://stranger' })
		const strangerSource = new Source({ integrationId: strangerIntegration.id, uri: 'stranger/calendar', entryTypes: [EntryType.Task], name: 'Theirs', enabled: true, hidden: false })
		const theirTask = new Entry({ id: crypto.randomUUID(), sourceId: strangerSource.id, uid: 'theirs', type: EntryType.Task, heading: 'theirs', status: TaskStatus.Done })
		em.persist([stranger, strangerIntegration, strangerSource, theirTask])
		await em.flush()
		em.persist(new EntryRelation({ entryId: theirTask.id!, type: RelationType.Parent, targetUid: 'parent' }))
		await em.flush()

		await attachRollups(em, user, [parent])
		assert.equal(parent.subtasks, undefined)
	})

	describe('resolveHierarchyView', () => {
		const identity = (entry: Entry) => entry

		it('answers the direct parents with their own rollups attached', async () => {
			const parent = await task('parent')
			const child = await task('a', TaskStatus.Done)
			await relate(child, RelationType.Parent, 'parent')

			const view = await resolveHierarchyView(em, user, child, identity)
			assert.deepEqual(view.parents.map(found => found.uid), ['parent'])
			assert.deepEqual(view.parents[0]!.subtasks, { done: 1, total: 1, progress: 1, children: 1, descendants: 1 })
			assert.equal(parent.uid, view.parents[0]!.uid)
		})

		it('answers the whole subtree beneath the entry, and never the entry itself', async () => {
			const parent = await task('parent')
			const child = await task('a')
			const grandchild = await task('b')
			await relate(child, RelationType.Parent, 'parent')
			await relate(grandchild, RelationType.Parent, 'a')

			const view = await resolveHierarchyView(em, user, parent, identity)
			assert.deepEqual(view.descendants.map(found => found.uid).sort(), ['a', 'b'])
			assert.equal(view.parents.length, 0)
		})

		it('answers empty for an entry with no uid', async () => {
			const draft = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'draft' })
			const view = await resolveHierarchyView(em, user, draft, identity)
			assert.deepEqual(view, { parents: [], descendants: [] })
		})
	})
})
