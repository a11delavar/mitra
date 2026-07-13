import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Source, SourceType, Entry, EntryType, Recurrence } from '../shared/index.js'
import { Dev } from './Dev.js'
import { NotificationSubscription } from './NotificationSubscription.js'
import { Session } from './Session.js'

// Ownership scoping for the /entries routes. A route must resolve user-owned entities through
// `req.user.sources/…` — a bare `em.find(Source, …)` sees EVERY user's rows, so in multi-user (OIDC)
// mode it leaks one user's data to another. The regression that motivated this file: GET
// /entries/search resolved its visible sources with a bare `em.find(Source, { enabled, hidden })`,
// searching across every user's calendars. These tests pin the scoping guarantee the fix relies on.

/** A private in-memory ORM (never the file-backed singleton in orm.ts) with the production entity set
 * and naming strategy, so `User.sources`' `$and`/`$in` filter is exercised against real SQLite. */
async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Dev, Source, Entry, Recurrence, NotificationSubscription, Session],
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

/** Seeds a user owning one Dev integration with a single source, plus one entry on it whose heading
 * carries `term`. The source's visibility (enabled/hidden) is caller-controlled. */
async function seedUser(em: EntityManager, username: string, term: string, source: Partial<Source> = {}) {
	const user = new User({ username })
	const integration = new Dev({ userId: user.id, uri: `dev://${username}` })
	const src = new Source({ integrationId: integration.id, uri: `${username}/calendar`, type: SourceType.Event, name: username, enabled: true, hidden: false, ...source })
	const entry = new Entry({ id: crypto.randomUUID(), sourceId: src.id, type: EntryType.Event, heading: `${term} (${username})` })
	em.persist([user, integration, src, entry])
	await em.flush()
	return { user, integration, source: src, entry }
}

/** Mirrors the entry query GET /entries/search runs, given a set of visible source ids. */
function searchEntries(em: EntityManager, sourceIds: Array<string>, q: string) {
	const term = `%${q.trim()}%`
	return em.find(Entry, {
		sourceId: { $in: sourceIds },
		$or: [
			{ heading: { $like: term } },
			{ description: { $like: term } },
			{ location: { $like: term } },
		],
	}, { orderBy: { start: 'desc' }, limit: 20 })
}

describe('entries ownership scoping', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	describe('User.sources (what /entries and /entries/search resolve through)', () => {
		it('returns only the requesting user\'s sources, never another user\'s', async () => {
			const em = orm.em.fork()
			const alice = await seedUser(em, 'alice', 'standup')
			const bob = await seedUser(em, 'bob', 'standup')

			const aliceSources = await alice.user.sources(em, { enabled: true, hidden: false })
			assert.deepEqual(aliceSources.map(source => source.id), [alice.source.id])

			const bobSources = await bob.user.sources(em, { enabled: true, hidden: false })
			assert.deepEqual(bobSources.map(source => source.id), [bob.source.id])
		})

		it('still honours the visibility filter within the user\'s own sources', async () => {
			const em = orm.em.fork()
			const { user, integration, source: visibleSource } = await seedUser(em, 'carol', 'standup')
			// A second source of hers that must be filtered out: disabled AND hidden.
			const hidden = new Source({ integrationId: integration.id, uri: 'carol/hidden', type: SourceType.Event, name: 'hidden', enabled: false, hidden: true })
			em.persist(hidden)
			await em.flush()

			const visible = await user.sources(em, { enabled: true, hidden: false })
			assert.deepEqual(visible.map(source => source.id), [visibleSource.id])
		})
	})

	describe('GET /entries/search scoping', () => {
		it('a scoped search returns only the requesting user\'s matching entries', async () => {
			const em = orm.em.fork()
			const alice = await seedUser(em, 'search-alice', 'roadmap')
			await seedUser(em, 'search-bob', 'roadmap') // Bob has a same-heading entry

			// The FIXED path: resolve visible sources through the user, then search within them.
			const visibleSources = await alice.user.sources(em, { enabled: true, hidden: false })
			const results = await searchEntries(em, visibleSources.map(source => source.id), 'roadmap')

			assert.deepEqual(results.map(entry => entry.id), [alice.entry.id])
		})

		it('regression: a BARE em.find(Source, …) leaks another user\'s entries into the results', async () => {
			const em = orm.em.fork()
			const alice = await seedUser(em, 'leak-alice', 'secret-project')
			const bob = await seedUser(em, 'leak-bob', 'secret-project')

			// The OLD, unscoped resolution the fix removed — visible sources across EVERY user.
			const bareSources = await em.find(Source, { enabled: true, hidden: false })
			const leaked = await searchEntries(em, bareSources.map(source => source.id), 'secret-project')

			// Both users' entries come back — the very leak the scoping fix closes.
			assert.deepEqual(new Set(leaked.map(entry => entry.id)), new Set([alice.entry.id, bob.entry.id]))
		})
	})
})
