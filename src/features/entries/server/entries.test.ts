import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../identity/User.js'
import { Source } from '../../sources/Source.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { Integration } from '../../../integrations/Integration.js'
import { Identity } from '../../identity/Identity.js'
import { GoogleCalendar } from '../../../integrations/google/GoogleCalendar.js'
import { EntryType } from '../EntryType.js'
import { Entry } from '../Entry.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { AppleCalendar } from '../../../integrations/apple/AppleCalendar.js'
import { Dev } from '../../../integrations/dev/Dev.js'
import { NotificationSubscription } from '../../reminders/NotificationSubscription.js'
import { Session } from '../../identity/server/Session.js'

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
	const src = new Source({ integrationId: integration.id, uri: `${username}/calendar`, entryTypes: [EntryType.Event], name: username, enabled: true, hidden: false, ...source })
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

/** Mirrors the entry query GET /entries runs, including the undated arm. Recurring masters are
 * excluded there and expanded separately (see occurrences.ts). */
function windowedEntries(em: EntityManager, sourceIds: Array<string>, start: Date, end: Date) {
	return em.find(Entry, {
		sourceId: { $in: sourceIds },
		recurrence: { freq: null },
		$or: [
			{ start: { $gte: start, $lte: end } },
			{ end: { $gte: start, $lte: end } },
			{ start: { $lte: start }, end: { $gte: end } },
			{ start: null },
		],
	})
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
			const hidden = new Source({ integrationId: integration.id, uri: 'carol/hidden', entryTypes: [EntryType.Event], name: 'hidden', enabled: false, hidden: true })
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

describe('GET /entries carries the undated rows in every window', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	/** An undated task belongs to no window, so only every window carrying it keeps the section on one
	 * fetch and one reconcile pass with the grid. */
	it('returns a task with no dates whichever window is asked for', async () => {
		const em = orm.em.fork()
		const { user, source } = await seedUser(em, 'undated', 'anything')
		const undated = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Write the report' })
		em.persist(undated)
		await em.flush()

		const sourceIds = (await user.sources(em, { enabled: true, hidden: false })).map(s => s.id)
		const june = await windowedEntries(em, sourceIds, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-30T00:00:00Z'))
		const december = await windowedEntries(em, sourceIds, new Date('2026-12-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'))

		assert.ok(june.some(entry => entry.id === undated.id))
		assert.ok(december.some(entry => entry.id === undated.id))
	})

	it('still windows the DATED ones — the undated arm widens nothing else', async () => {
		const em = orm.em.fork()
		const { user, source } = await seedUser(em, 'windowed', 'anything')
		const dated = new Entry({
			id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Ship it',
			start: new Date('2026-06-15T09:00:00Z') as never, end: new Date('2026-06-15T10:00:00Z') as never,
		})
		em.persist(dated)
		await em.flush()

		const sourceIds = (await user.sources(em, { enabled: true, hidden: false })).map(s => s.id)
		const june = await windowedEntries(em, sourceIds, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-30T00:00:00Z'))
		const december = await windowedEntries(em, sourceIds, new Date('2026-12-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'))

		assert.ok(june.some(entry => entry.id === dated.id))
		assert.ok(!december.some(entry => entry.id === dated.id))
	})

	it('scopes the undated rows to the requesting user like everything else', async () => {
		const em = orm.em.fork()
		const alice = await seedUser(em, 'undated-alice', 'anything')
		const bob = await seedUser(em, 'undated-bob', 'anything')
		const hers = new Entry({ id: crypto.randomUUID(), sourceId: alice.source.id, type: EntryType.Task, heading: 'Hers' })
		const his = new Entry({ id: crypto.randomUUID(), sourceId: bob.source.id, type: EntryType.Task, heading: 'His' })
		em.persist([hers, his])
		await em.flush()

		const sourceIds = (await alice.user.sources(em, { enabled: true, hidden: false })).map(s => s.id)
		const window = await windowedEntries(em, sourceIds, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-30T00:00:00Z'))

		assert.ok(window.some(entry => entry.id === hers.id))
		assert.ok(!window.some(entry => entry.id === his.id))
	})
})
