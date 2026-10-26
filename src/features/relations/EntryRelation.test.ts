import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User, Identity } from '#features/identity'
import { Source } from '#features/sources'
import { EntryType, Entry } from '#features/entries'
import { NotificationSubscription } from '#features/reminders/NotificationSubscription.js'
import { Session } from '#features/identity/server/Session.js'
import { Integration } from '#integrations'
import { GoogleCalendar } from '#integrations/google/GoogleCalendar.js'
import { CalDAV } from '#integrations/caldav/CalDAV.js'
import { AppleCalendar } from '#integrations/apple/AppleCalendar.js'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import { children } from '#infrastructure/model'
import { RelationType } from './RelationType.js'
import { EntryRelations } from './EntryRelations.js'
import { EntryRelation } from './EntryRelation.js'

// What the rows give a user's graph and a write path; the graph's own behaviour is tested purely beside it.

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, MitraCalendar, Source, Entry, EntryRelation, NotificationSubscription, Session],
		dbName: ':memory:',
		forceUndefined: true,
		namingStrategy: class extends UnderscoreNamingStrategy {
			override joinColumnName(propertyName: string) {
				return this.propertyToColumnName(propertyName)
			}

			override joinKeyColumnName(entityName: string) {
				return this.propertyToColumnName(entityName)
			}
		},
		subscribers: [children.subscriber],
		allowGlobalContext: true,
	})
	await orm.schema.update()
	return orm
}

describe('EntryRelation', () => {
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
		const integration = new MitraCalendar({ userId: user.id, uri: 'dev://owner' })
		source = new Source({ integrationId: integration.id, uri: 'owner/calendar', entryTypes: [EntryType.Event, EntryType.Task], name: 'Calendar', enabled: true, hidden: false })
		em.persist([user, integration, source])
		await em.flush()
	})

	/** One task on the user's source, identified by a stable uid so relations can target it. */
	async function task(uid: string) {
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uid, type: EntryType.Task, heading: uid })
		em.persist(entry)
		await em.flush()
		return entry
	}

	async function relate(owner: Entry, type: RelationType, targetUid: string) {
		em.persist(new EntryRelation({ entryId: owner.id!, type, targetUid }))
		await em.flush()
	}

	/** Another user's task, pointing at `targetUid` on the shared namespace of uids. */
	async function strangersTaskPointingAt(targetUid: string) {
		const stranger = new User({ username: 'stranger' })
		const theirs = new MitraCalendar({ userId: stranger.id, uri: 'dev://stranger' })
		const theirSource = new Source({ integrationId: theirs.id, uri: 'stranger/calendar', entryTypes: [EntryType.Task], name: 'Theirs', enabled: true, hidden: false })
		const theirTask = new Entry({ id: crypto.randomUUID(), sourceId: theirSource.id, uid: 'theirs', type: EntryType.Task, heading: 'theirs' })
		em.persist([stranger, theirs, theirSource, theirTask, new EntryRelation({ entryId: theirTask.id!, type: RelationType.Parent, targetUid })])
		await em.flush()
	}

	describe('the user\'s graph over the rows', () => {
		it('holds the rows of the user\'s own entries, both directions on every entry a read serves', async () => {
			const parent = await task('parent')
			const child = await task('a')
			await relate(child, RelationType.Parent, 'parent')

			const graph = await user.getRelationGraph(em)
			graph.attach([parent])
			assert.deepEqual(parent.relations?.all.map(relation => [relation.direction, relation.type.value, relation.targetUid]), [['incoming', 'PARENT', 'a']])
			assert.deepEqual(parent.relations?.all[0]?.target?.relations?.all.map(relation => [relation.direction, relation.targetUid]), [['outgoing', 'parent']])
		})

		it('never holds another user\'s row, even one pointing at a uid they share', async () => {
			await task('shared')
			await strangersTaskPointingAt('shared')

			const graph = await user.getRelationGraph(em)
			assert.deepEqual(graph.entries.map(entry => entry.uid), [])
			assert.equal(graph.getRollup('shared'), undefined)
		})

		it('reaches the entries the candidate relations name, though no row holds them yet', async () => {
			await task('a')
			await task('apart')

			const graph = await user.getRelationGraph(em, EntryRelations.of([{ type: RelationType.Parent, targetUid: 'a' }]))
			assert.equal(graph.getEntry('a')?.uid, 'a')
			assert.equal(graph.getEntry('apart'), undefined)
		})
	})

	describe('what a flush saves', () => {
		const stored = async (entry: Entry) => (await orm.em.fork().find(EntryRelation, { entryId: entry.id! })).map(row => `${row.type.value} ${row.targetUid}`).sort()

		it('saves the lines an entry is set to as its rows, an incoming one never, since the other entry owns it', async () => {
			const parent = await task('parent')
			parent.relations = EntryRelations.of([
				{ type: RelationType.Parent, targetUid: 'a', direction: 'incoming' },
				{ type: RelationType.FinishToStart, targetUid: 'b' },
			])
			await em.flush()
			assert.deepEqual(await stored(parent), ['FINISHTOSTART b'])
		})

		it('keeps the row a line still stands for, so a read attached and flushed again changes nothing', async () => {
			const child = await task('a')
			await relate(child, RelationType.Parent, 'parent')
			const [before] = await em.find(EntryRelation, { entryId: child.id! })
			const graph = await user.getRelationGraph(em)
			graph.attach([child])
			await em.flush()
			const [after] = await orm.em.fork().find(EntryRelation, { entryId: child.id! })
			assert.equal(after?.id, before?.id)
		})

		it('reads the stored lines on a loaded entry, unknown on one made outside the ORM, and keeps the rows of one given none', async () => {
			const child = await task('a')
			await relate(child, RelationType.Parent, 'parent')
			const loaded = await orm.em.fork().findOneOrFail(Entry, { id: child.id })
			assert.deepEqual(loaded.relations?.all.map(relation => [relation.direction, relation.targetUid]), [['outgoing', 'parent']])
			assert.equal(new Entry({ sourceId: source.id }).relations, undefined)
			child.relations = undefined
			await em.flush()
			assert.deepEqual(await stored(child), ['PARENT parent'])
		})
	})
})
