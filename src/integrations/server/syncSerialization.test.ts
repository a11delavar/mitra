import { describe, it, before, after } from 'node:test'
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
import { Integration, integration } from '../Integration.js'
import { model } from '../../infrastructure/model/model.js'

/**
 * The duplicate-import bug, reproduced at its root: two sync paths for ONE account running at the same
 * time — the background daemon's cycle and a request that syncs (connect, edit, re-import) — each
 * reading "nothing here yet" from its own entity-manager fork and then inserting the same rows.
 *
 * It has to be caught here because neither database constraint catches it: `source` carries no unique
 * index at all, and `entry`'s (source_id, uri, recurrence_id) is defeated by SQLite treating NULLs as
 * distinct, which every non-recurring row has. The symptom is silent — every entry simply appears
 * twice — and no single-threaded test of either path can produce it.
 */

@model('SlowProvider')
@integration('slow-provider-test')
class SlowProvider extends Integration<Record<string, never>> {
	static readonly label = 'Slow'
	static readonly logo = 'slow'
	static readonly description = 'A provider whose sync is slow enough to overlap'

	/** Counts how often the network was actually consulted — one per sync that really ran. */
	static fetches = 0

	constructor(init?: Partial<SlowProvider>) {
		super()
		Object.assign(this, init)
	}

	override merge() { }

	protected override async fetchSources(): Promise<Array<Source>> {
		SlowProvider.fetches++
		// The window a real provider's round trip opens, and the whole point of the reproduction.
		await new Promise(resolve => setTimeout(resolve, 20))
		return [new Source({ uri: 'slow://calendar', name: 'Work', entryTypes: [EntryType.Event], enabled: true })]
	}

	protected override async syncSourceEntries(em: EntityManager, source: Source): Promise<boolean> {
		const existing = await em.find(Entry, { sourceId: source.id })
		const byUri = new Map(existing.map(entry => [entry.uri, entry]))
		await new Promise(resolve => setTimeout(resolve, 20))
		for (const uri of ['a', 'b']) {
			if (!byUri.has(uri)) {
				em.persist(new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri, heading: uri, type: EntryType.Event }))
			}
		}
		return true
	}
}

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, SlowProvider, Source, Entry, EntryRelation, Recurrence, NotificationSubscription, Session],
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

describe('concurrent syncs of one integration', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	const seed = async () => {
		const em = orm.em.fork()
		const user = new User({ username: `alice-${crypto.randomUUID()}` })
		const account = new SlowProvider({ userId: user.id, uri: `slow://${crypto.randomUUID()}` })
		em.persist([user, account])
		await em.flush()
		return account.id
	}

	const counts = async (integrationId: string) => {
		const em = orm.em.fork()
		const sources = await em.find(Source, { integrationId })
		return {
			sources: sources.length,
			entries: await em.count(Entry, { sourceId: { $in: sources.map(source => source.id) } }),
		}
	}

	/** Each caller gets its OWN fork, exactly as the daemon and a request route do. */
	const syncFrom = async (integrationId: string) => {
		const em = orm.em.fork()
		const account = await em.findOneOrFail(SlowProvider, { id: integrationId })
		await account.sync(em)
		await em.flush()
	}

	it('imports each source and entry once, however many cycles start at the same moment', async () => {
		const integrationId = await seed()
		SlowProvider.fetches = 0

		await Promise.all([syncFrom(integrationId), syncFrom(integrationId), syncFrom(integrationId)])

		// Three real syncs ran — they were serialized, not skipped — and the later ones found the
		// earlier one's committed rows instead of inserting their own copies.
		assert.equal(SlowProvider.fetches, 3)
		assert.deepEqual(await counts(integrationId), { sources: 1, entries: 2 })
	})

	it('serializes a connect against a cycle that is already running', async () => {
		const integrationId = await seed()
		const em = orm.em.fork()
		const account = await em.findOneOrFail(SlowProvider, { id: integrationId })

		// applyAndSync is what POST/PUT /integrations run, outside the daemon's own queue entirely.
		await Promise.all([
			account.applyAndSync(em, new SlowProvider({ sources: [new Source({ uri: 'slow://calendar', enabled: true })] as never })),
			syncFrom(integrationId),
		])

		assert.deepEqual(await counts(integrationId), { sources: 1, entries: 2 })
	})

	it('keeps the queue alive after one cycle fails', async () => {
		const integrationId = await seed()
		const failure = Integration.exclusively(integrationId, () => Promise.reject(new Error('provider down')))

		await assert.rejects(() => failure, /provider down/)
		await syncFrom(integrationId)

		assert.deepEqual(await counts(integrationId), { sources: 1, entries: 2 })
	})
})
