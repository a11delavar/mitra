import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../features/identity/User.js'
import { Identity } from '../../features/identity/Identity.js'
import { Source } from '../../features/sources/Source.js'
import { Recurrence } from '../../features/recurrence/Recurrence.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryRelation } from '../../features/relations/EntryRelation.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { NotificationSubscription } from '../../features/reminders/NotificationSubscription.js'
import { Session } from '../../features/identity/server/Session.js'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { Integration, integration } from '../Integration.js'
import { model } from '../../infrastructure/model/model.js'
import { Importer } from './Importer.js'

/** Mock multi-page provider simulating paginated/truncated sync passes. */
@model('PagedProvider')
@integration('paged-provider-test')
class PagedProvider extends Integration<Record<string, never>> {
	static readonly label = 'Paged'
	static readonly logo = 'paged'
	static readonly description = 'A provider that needs several passes to hand everything over'

	static pages = 2
	static failFirstPass = false
	static passes = 0

	constructor(init?: Partial<PagedProvider>) {
		super()
		Object.assign(this, init)
	}

	override merge() { }

	protected override fetchSources(): Promise<Array<Source>> {
		return Promise.resolve([new Source({ uri: 'paged://calendar', name: 'Work', entryTypes: [EntryType.Event], enabled: true })])
	}

	protected override async syncSourceEntries(em: EntityManager, source: Source): Promise<boolean> {
		PagedProvider.passes++
		if (PagedProvider.failFirstPass && PagedProvider.passes === 1) {
			throw new Error('provider down')
		}
		const delivered = await em.count(Entry, { sourceId: source.id })
		if (delivered >= PagedProvider.pages) {
			source.syncState = {}
			return false
		}
		em.persist(new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: `page-${delivered}`, heading: `Page ${delivered}`, type: EntryType.Event }))
		source.syncState = delivered + 1 < PagedProvider.pages ? { incomplete: true } : {}
		return true
	}
}

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, PagedProvider, Source, Entry, EntryRelation, Recurrence, NotificationSubscription, Session],
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

describe('importing a source', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	beforeEach(() => {
		PagedProvider.pages = 2
		PagedProvider.failFirstPass = false
		PagedProvider.passes = 0
	})

	const connect = async () => {
		const em = orm.em.fork()
		const user = new User({ username: `alice-${crypto.randomUUID()}` })
		const account = new PagedProvider({ userId: user.id, uri: `paged://${crypto.randomUUID()}` })
		em.persist([user, account])
		await account.apply(em, new PagedProvider({ sources: [new Source({ uri: 'paged://calendar', enabled: true })] as never }))
		return { em, userId: user.id, integrationId: account.id }
	}

	const sourceOf = (integrationId: string) => orm.em.fork().findOneOrFail(Source, { integrationId })

	it('answers the connect before any entry is read, leaving the source importing', async () => {
		const { integrationId } = await connect()

		assert.equal(PagedProvider.passes, 0)
		const source = await sourceOf(integrationId)
		assert.equal(source.importing, true)
		assert.equal(await orm.em.fork().count(Entry, { sourceId: source.id }), 0)
	})

	it('keeps reading while the provider cuts its listing short, then stops importing', async () => {
		const { em, userId, integrationId } = await connect()

		await new Importer().start(em, userId, integrationId)

		const source = await sourceOf(integrationId)
		assert.equal(source.importing, false)
		assert.ok(source.importedAt instanceof Date)
		assert.equal(PagedProvider.passes, 2)
		assert.equal(await orm.em.fork().count(Entry, { sourceId: source.id }), 2)
	})

	it('ends the import on the pass that reads the source whole, without a further quiet one', async () => {
		PagedProvider.pages = 1
		const { em, userId, integrationId } = await connect()

		await new Importer().start(em, userId, integrationId)

		assert.equal(PagedProvider.passes, 1)
		assert.equal((await sourceOf(integrationId)).importing, false)
	})

	it('publishes after every pass, so entries appear while the rest is still arriving', async () => {
		const { em, userId, integrationId } = await connect()
		let published = 0
		const listener = (id: string, scope: string) => {
			if (id === userId && scope === 'sources') {
				published++
			}
		}
		syncEmitter.on('updated', listener)

		await new Importer().start(em, userId, integrationId)
		syncEmitter.off('updated', listener)

		assert.equal(published, 2)
	})

	it('leaves the source importing when the provider fails, for the synchronizer to retry', async () => {
		PagedProvider.failFirstPass = true
		const { em, userId, integrationId } = await connect()

		await new Importer().start(em, userId, integrationId)

		assert.equal((await sourceOf(integrationId)).importing, true)
	})

	it('joins the run already importing an integration instead of starting a second one', async () => {
		const { em, userId, integrationId } = await connect()
		const importer = new Importer()

		await Promise.all([
			importer.start(em, userId, integrationId),
			importer.start(em, userId, integrationId),
		])

		assert.equal(PagedProvider.passes, 2)
		assert.equal(await orm.em.fork().count(Entry, { sourceId: (await sourceOf(integrationId)).id }), 2)
	})

	it('re-imports by discarding the entries and awaiting a full read again', async () => {
		const { em, userId, integrationId } = await connect()
		await new Importer().start(em, userId, integrationId)

		const reimportEm = orm.em.fork()
		const account = await reimportEm.findOneOrFail(PagedProvider, { id: integrationId })
		const source = await reimportEm.findOneOrFail(Source, { integrationId })
		await account.reimportSource(reimportEm, source)

		assert.equal(source.importing, true)
		assert.equal(source.syncState, undefined)
		assert.equal(await orm.em.fork().count(Entry, { sourceId: source.id }), 0)

		await new Importer().start(reimportEm, userId, integrationId)
		assert.equal((await sourceOf(integrationId)).importing, false)
		assert.equal(await orm.em.fork().count(Entry, { sourceId: source.id }), 2)
	})
})
