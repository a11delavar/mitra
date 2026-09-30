import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../features/identity/User.js'
import { Identity } from '../../features/identity/Identity.js'
import { Source } from '../../features/sources/Source.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { EntryRelation } from '../../features/relations/EntryRelation.js'
import { Recurrence } from '../../features/recurrence/Recurrence.js'
import { Integration } from '../Integration.js'
import { MitraCalendar } from './MitraCalendar.js'
import { Demo } from '../demo/Demo.js'

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, MitraCalendar, Demo, Source, Entry, Recurrence, EntryRelation],
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

let orm: MikroORM
let users = 0

/** A fresh user with a mitra integration holding one calendar and one entry in it. */
async function seed(em: EntityManager) {
	const user = new User({ username: `user-${++users}` })
	const integration = new MitraCalendar({ userId: user.id })
	em.persist([user, integration])
	await em.flush()

	const source = new Source({ name: 'Personal', enabled: true })
	await integration.createSource(em, source)
	const entry = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'Dentist' })
	em.persist(entry)
	await em.flush()

	return { user, integration, source, entry }
}

describe('MitraCalendar', () => {
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	describe('capabilities', () => {
		it('manages its own sources, since no remote discovery can', () => {
			const capabilities = new MitraCalendar().capabilities
			assert.equal(capabilities.createSources, true)
			assert.equal(capabilities.deleteSources, true)
		})

		it('every other integration declares source management off by default', () => {
			assert.equal(Integration.defaultCapabilities.createSources, false)
			assert.equal(Integration.defaultCapabilities.deleteSources, false)
		})

		it('a read-only calendar cannot be deleted from mitra either', () => {
			const masked = new MitraCalendar().capabilitiesFor({ readOnly: true })
			assert.equal(masked.deleteSources, false)
			assert.equal(masked.createSources, true) // integration-level, so never masked per source
		})

		it('is never polled: the pacer skips a local-only integration outright', () => {
			assert.equal(new MitraCalendar().syncInterval, Infinity)
			assert.equal(Number.isFinite(new MitraCalendar().syncInterval), false)
		})

		it('declares what the add dialog and sidebar need to know about it', () => {
			assert.equal(MitraCalendar.onePerUser, true)
			assert.equal(MitraCalendar.discoversSources, false)
			assert.equal(MitraCalendar.developmentOnly, false)
			assert.equal(new MitraCalendar().reimportable, false)
		})

		it('every other integration keeps the defaults', () => {
			assert.equal(Integration.onePerUser, false)
			assert.equal(Integration.discoversSources, true)
			assert.equal(Integration.developmentOnly, false)
		})
	})

	describe('source reconcile', () => {
		it('survives a reconcile, since the stored sources are the provider', async () => {
			const em = orm.em.fork()
			const { integration, source, entry } = await seed(em)

			const reconciled = await integration.getSources(em)
			await em.flush()

			assert.deepEqual(reconciled.map(s => s.id), [source.id])
			assert.equal(await em.count(Source, { integrationId: integration.id }), 1)
			assert.equal(await em.count(Entry, { id: entry.id }), 1)
		})

		/** Returning [] from fetchSources would make getSources delete every stored source. */
		it('an Edit → Save round-trip does not cascade-delete the calendars and their entries', async () => {
			const em = orm.em.fork()
			const { integration, source, entry } = await seed(em)

			// A separate context, like the API: populate won't refill a collection this one already holds.
			const listing = orm.em.fork()
			const served = await listing.findOneOrFail(MitraCalendar, { id: integration.id }, { populate: ['sources'] })
			await integration.apply(em, served.editableCopy())
			await em.flush()

			assert.equal(await em.count(Source, { integrationId: integration.id }), 1, 'the calendar survived')
			assert.equal(await em.count(Entry, { id: entry.id }), 1, 'its entries survived')
			assert.equal((await em.findOneOrFail(Source, { id: source.id })).enabled, true)
		})

		it('the copy the edit dialog shows keeps an imported calendar imported, in its color', async () => {
			const em = orm.em.fork()
			const { integration, source } = await seed(em)
			source.color = '#123456'
			await em.flush()

			const served = await orm.em.fork().findOneOrFail(MitraCalendar, { id: integration.id }, { populate: ['sources'] })
			const [copy] = [...served.editableCopy().sources]
			assert.equal(copy!.importing, false)
			assert.equal(copy!.color, '#123456')
		})

		it('a background sync changes nothing and reports no change', async () => {
			const em = orm.em.fork()
			const { integration, source } = await seed(em)

			assert.equal(await integration.sync(em), false)
			assert.equal(await em.count(Source, { id: source.id }), 1)
		})

		it('re-import is a no-op, since wiping and refetching would destroy the only copy', async () => {
			const em = orm.em.fork()
			const { integration, source, entry } = await seed(em)

			await integration.reimportSource(em, source)
			await em.flush()

			assert.equal(await em.count(Entry, { id: entry.id }), 1)
		})
	})

	describe('source management', () => {
		it('mints a uri for a created calendar and files it under the integration', async () => {
			const em = orm.em.fork()
			const { integration } = await seed(em)

			const source = new Source({ name: 'Work' })
			await integration.createSource(em, source)
			await em.flush()

			assert.equal(source.integrationId, integration.id)
			assert.equal(source.uri, `mitra://calendar/${source.id}`)
			assert.equal((await em.findOneOrFail(Source, { id: source.id })).name, 'Work')
		})

		it('holds events and tasks unless told otherwise', async () => {
			const em = orm.em.fork()
			const { integration } = await seed(em)
			const source = new Source({ name: 'Work' })
			await integration.createSource(em, source)
			assert.equal(source.supportsEntryType(EntryType.Event), true)
			assert.equal(source.supportsEntryType(EntryType.Task), true)
		})

		it('deleting a calendar takes its entries and their relations with it', async () => {
			const em = orm.em.fork()
			const { integration, source, entry } = await seed(em)
			const other = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Book it' })
			em.persist([other, new EntryRelation({ entryId: other.id!, type: 'PARENT', targetUid: entry.uid! } as never)])
			await em.flush()

			await integration.deleteSource(em, source)
			await em.flush()

			assert.equal(await em.count(Source, { id: source.id }), 0)
			assert.equal(await em.count(Entry, { sourceId: source.id }), 0)
			assert.equal(await em.count(EntryRelation, { entryId: other.id! }), 0)
		})

		it('leaves the integration and its other calendars standing', async () => {
			const em = orm.em.fork()
			const { integration, source } = await seed(em)
			const kept = new Source({ name: 'Work' })
			await integration.createSource(em, kept)
			await em.flush()

			await integration.deleteSource(em, source)
			await em.flush()

			assert.equal(await em.count(Integration, { id: integration.id }), 1)
			assert.deepEqual((await em.find(Source, { integrationId: integration.id })).map(s => s.name), ['Work'])
		})

		it('a provider that declares no source management has no operation to reach for', async () => {
			const em = orm.em.fork()
			const { integration } = await seed(em)
			// The route gates on the capability; this is the backstop behind it.
			await assert.rejects(
				() => Promise.resolve().then(() => Integration.prototype.createSource.call(integration, em, new Source({ name: 'x' }))),
				/sync engine/,
			)
		})
	})

	describe('one per account', () => {
		it('a second mitra integration collides on the uri the first already claims', async () => {
			const em = orm.em.fork()
			const { user } = await seed(em)

			em.persist(new MitraCalendar({ userId: user.id }))
			await assert.rejects(() => em.flush())
		})

		it('but two accounts each get their own', async () => {
			const em = orm.em.fork()
			await seed(em)
			await seed(em)
			assert.equal((await em.find(MitraCalendar, {})).length >= 2, true)
		})
	})
})

describe('Demo', () => {
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	let em: EntityManager
	let demo: Demo

	beforeEach(async () => {
		em = orm.em.fork()
		const user = new User({ username: `demo-${++users}` })
		demo = new Demo({ userId: user.id })
		em.persist([user, demo])
		await em.flush()
	})

	/** Only this demo's entries; earlier tests share the database. */
	async function entryIds() {
		const sources = await em.find(Source, { integrationId: demo.id })
		return (await em.find(Entry, { sourceId: { $in: sources.map(source => source.id) } })).map(entry => entry.id)
	}

	/** Counts filled calendars rather than entries, since the fixture size changes. */
	async function filledCalendars() {
		const sources = await em.find(Source, { integrationId: demo.id })
		const counts = await Promise.all(sources.map(source => em.count(Entry, { sourceId: source.id })))
		return sources.filter((_, index) => counts[index]! > 0).length
	}

	it('is polled, unlike its parent, because the fixtures roll over daily', () => {
		assert.equal(Number.isFinite(demo.syncInterval), true)
		assert.equal(Number.isFinite(new MitraCalendar().syncInterval), false)
	})

	it('is development-only and discovers its sample calendars, one per user like its parent', () => {
		assert.equal(Demo.developmentOnly, true)
		assert.equal(Demo.discoversSources, true)
		assert.equal(Demo.onePerUser, true)
		assert.equal(demo.reimportable, true)
	})

	it('offers the five sample calendars on a first reconcile', async () => {
		const sources = await demo.getSources(em)
		await em.flush()
		assert.deepEqual(sources.map(source => source.name).sort(), ['Hobbies', 'Personal', 'University', 'Upkeep', 'Work'])
		assert.equal(sources.every(source => source.uri.startsWith('mitra://sample/')), true)
	})

	it('fills itself the moment it is added, and stops there', async () => {
		await demo.getSources(em)
		await em.flush()

		assert.equal(await demo.syncEntries(em), true)
		await em.flush()
		const seeded = (await entryIds()).length
		assert.equal(await filledCalendars(), 5, 'every sample calendar was filled')

		assert.equal(await demo.syncEntries(em), false, 'already anchored to today')
		await em.flush()
		assert.equal((await entryIds()).length, seeded)
	})

	it('a day rollover rebuilds the entries but keeps the calendars the user has made their own', async () => {
		await demo.getSources(em)
		await em.flush()
		await demo.syncEntries(em)
		await em.flush()

		const work = await em.findOneOrFail(Source, { integrationId: demo.id, uri: Demo.sampleUri('work') })
		work.name = 'Day job'
		work.color = '#123456'
		const before = await entryIds()
		await em.flush()

		demo.credentials = { ...demo.credentials, seededFor: '2000-1-1' }
		assert.equal(await demo.syncEntries(em), true)
		await em.flush()

		const renamed = await em.findOneOrFail(Source, { id: work.id })
		assert.equal(renamed.name, 'Day job', 'the calendar survived the rebuild')
		assert.equal(renamed.color, '#123456')

		const after = await entryIds()
		assert.equal(await filledCalendars(), 5)
		assert.equal(after.length, before.length, 'the same fixtures, rebuilt')
		assert.equal(after.some(id => before.includes(id)), false, 'every entry was rebuilt')
	})

	it('restores a sample calendar the user deleted, without disturbing the ones they added', async () => {
		await demo.getSources(em)
		await em.flush()

		const mine = new Source({ name: 'Mine' })
		await demo.createSource(em, mine)
		const hobbies = await em.findOneOrFail(Source, { uri: Demo.sampleUri('hobbies') })
		await demo.deleteSource(em, hobbies)
		await em.flush()

		await demo.getSources(em)
		await em.flush()

		const names = (await em.find(Source, { integrationId: demo.id })).map(source => source.name).sort()
		assert.deepEqual(names, ['Hobbies', 'Mine', 'Personal', 'University', 'Upkeep', 'Work'])
	})

	it('re-import queues a rebuild: the anchor is cleared and the calendars await import again', async () => {
		const sources = await demo.getSources(em)
		await em.flush()
		await demo.syncEntries(em)
		await em.flush()
		const before = await entryIds()

		await demo.reimportSource(em, sources[0]!)
		await em.flush()

		assert.equal(demo.credentials.seededFor, undefined, 'the day anchor is cleared, so the next pass reseeds')
		assert.equal(sources[0]!.importing, true)

		// What the importer then does, one pass per pending source.
		assert.equal(await demo.syncSource(em, sources[0]!), true)
		await em.flush()
		const after = await entryIds()
		assert.equal(await filledCalendars(), 5)
		assert.equal(after.some(id => before.includes(id)), false)
	})
})
