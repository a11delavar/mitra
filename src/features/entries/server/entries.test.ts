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
import { Entry, TaskStatus } from '../Entry.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { AppleCalendar } from '../../../integrations/apple/AppleCalendar.js'
import { Dev } from '../../../integrations/dev/Dev.js'
import { NotificationSubscription } from '../../reminders/NotificationSubscription.js'
import { Session } from '../../identity/server/Session.js'
import { entryWindow, everyEntry } from './entryWindow.js'
import { seriesStarts } from '../../recurrence/server/occurrences.js'

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

async function seedUser(em: EntityManager, username: string, term: string, source: Partial<Source> = {}) {
	const user = new User({ username })
	const integration = new Dev({ userId: user.id, uri: `dev://${username}` })
	const src = new Source({ integrationId: integration.id, uri: `${username}/calendar`, entryTypes: [EntryType.Event], name: username, enabled: true, hidden: false, ...source })
	const entry = new Entry({ id: crypto.randomUUID(), sourceId: src.id, type: EntryType.Event, heading: `${term} (${username})` })
	em.persist([user, integration, src, entry])
	await em.flush()
	return { user, integration, source: src, entry }
}

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

function windowedEntries(em: EntityManager, sourceIds: Array<string>, start: Date, end: Date) {
	return em.find(Entry, entryWindow(sourceIds, start, end))
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
			await seedUser(em, 'search-bob', 'roadmap')

			const visibleSources = await alice.user.sources(em, { enabled: true, hidden: false })
			const results = await searchEntries(em, visibleSources.map(source => source.id), 'roadmap')

			assert.deepEqual(results.map(entry => entry.id), [alice.entry.id])
		})

		it('regression: a bare em.find(Source, …) leaks another user\'s entries into the results', async () => {
			const em = orm.em.fork()
			const alice = await seedUser(em, 'leak-alice', 'secret-project')
			const bob = await seedUser(em, 'leak-bob', 'secret-project')

			const bareSources = await em.find(Source, { enabled: true, hidden: false })
			const leaked = await searchEntries(em, bareSources.map(source => source.id), 'secret-project')

			assert.deepEqual(new Set(leaked.map(entry => entry.id)), new Set([alice.entry.id, bob.entry.id]))
		})
	})
})

describe('GET /entries carries the overdue backlog in every window', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	const task = (sourceId: string, heading: string, dates: Partial<Entry>) =>
		new Entry({ id: crypto.randomUUID(), sourceId, type: EntryType.Task, heading, ...dates })

	const june = [new Date('2026-06-01T00:00:00Z'), new Date('2026-06-30T00:00:00Z')] as const

	it('reaches tasks due long before the window, whatever their status column says', async () => {
		const em = orm.em.fork()
		const { user, source } = await seedUser(em, 'backlog', 'anything')
		const [from, to] = [new Date('2021-03-02T09:00:00Z') as never, new Date('2021-03-02T10:00:00Z') as never]
		const untouched = task(source.id, 'Untouched', { start: from, end: to })
		const started = task(source.id, 'Started', { start: from, end: to, status: TaskStatus.Doing })
		const dueOnly = task(source.id, 'No due date', { start: from })
		em.persist([untouched, started, dueOnly])
		await em.flush()

		const sourceIds = (await user.sources(em, { enabled: true, hidden: false })).map(s => s.id)
		const found = (await windowedEntries(em, sourceIds, ...june)).map(entry => entry.id)

		assert.ok(found.includes(untouched.id))
		assert.ok(found.includes(started.id))
		assert.ok(found.includes(dueOnly.id))
	})

	it('leaves settled tasks and bygone events where they are', async () => {
		const em = orm.em.fork()
		const { user, source } = await seedUser(em, 'settled', 'anything')
		const [from, to] = [new Date('2021-03-02T09:00:00Z') as never, new Date('2021-03-02T10:00:00Z') as never]
		const done = task(source.id, 'Done', { start: from, end: to, status: TaskStatus.Done })
		const cancelled = task(source.id, 'Cancelled', { start: from, end: to, status: TaskStatus.Cancelled })
		const event = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'Last year', start: from, end: to })
		em.persist([done, cancelled, event])
		await em.flush()

		const sourceIds = (await user.sources(em, { enabled: true, hidden: false })).map(s => s.id)
		const found = (await windowedEntries(em, sourceIds, ...june)).map(entry => entry.id)

		assert.ok(!found.includes(done.id))
		assert.ok(!found.includes(cancelled.id))
		assert.ok(!found.includes(event.id))
	})

	it('does not drag the future backwards', async () => {
		const em = orm.em.fork()
		const { user, source } = await seedUser(em, 'ahead', 'anything')
		const later = task(source.id, 'Later', { start: new Date('2027-09-02T09:00:00Z') as never, end: new Date('2027-09-02T10:00:00Z') as never })
		em.persist(later)
		await em.flush()

		const sourceIds = (await user.sources(em, { enabled: true, hidden: false })).map(s => s.id)
		const found = (await windowedEntries(em, sourceIds, ...june)).map(entry => entry.id)

		assert.ok(!found.includes(later.id))
	})
})

describe('GET /entries carries the undated rows in every window', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

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

	it('still windows the dated ones', async () => {
		const em = orm.em.fork()
		const { user, source } = await seedUser(em, 'windowed', 'anything')
		const dated = new Entry({
			id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'Ship it',
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

describe('GET /entries/all lists every entry once', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	async function everything(em: EntityManager, user: User) {
		const sourceIds = (await user.sources(em, { enabled: true, hidden: false })).map(s => s.id)
		return [...await em.find(Entry, everyEntry(sourceIds)), ...await seriesStarts(em, sourceIds)]
	}

	it('reaches entries of any date, undated ones included', async () => {
		const em = orm.em.fork()
		const { user, source, entry: undated } = await seedUser(em, 'all-dates', 'anything')
		const long = new Entry({
			id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'Long ago',
			start: new Date('2001-03-01T09:00:00Z') as never, end: new Date('2001-03-01T10:00:00Z') as never,
		})
		em.persist(long)
		await em.flush()

		const ids = (await everything(em, user)).map(entry => entry.id)
		assert.ok(ids.includes(long.id))
		assert.ok(ids.includes(undated.id))
	})

	it('lists a series as the one occurrence it starts on, never its master or its overrides', async () => {
		const em = orm.em.fork()
		const { user, source } = await seedUser(em, 'all-series', 'anything')
		const start = new Date('2024-01-05T07:30:00Z')
		const master = new Entry({
			id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'Morning meds',
			start: start as never, end: new Date('2024-01-05T07:35:00Z') as never, recurrence: new Recurrence({ freq: 'DAILY' }),
		})
		const override = new Entry({
			id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'Morning meds, later',
			start: new Date('2024-02-01T09:00:00Z') as never, end: new Date('2024-02-01T09:05:00Z') as never,
			recurrenceMasterId: master.id, recurrenceId: new Date('2024-02-01T07:30:00Z') as never,
		})
		em.persist([master, override])
		await em.flush()

		const rows = (await everything(em, user)).filter(entry => entry.heading.startsWith('Morning meds'))
		assert.equal(rows.length, 1)
		const [series] = rows
		assert.equal(series!.recurrenceMasterId, master.id)
		assert.equal(series!.recurrenceId?.valueOf(), start.valueOf())
		assert.equal(series!.seriesStart?.valueOf(), start.valueOf())
	})

	it('scopes to the requesting user like every window', async () => {
		const em = orm.em.fork()
		const alice = await seedUser(em, 'all-alice', 'anything')
		const bob = await seedUser(em, 'all-bob', 'anything')

		const ids = (await everything(em, alice.user)).map(entry => entry.id)
		assert.ok(ids.includes(alice.entry.id))
		assert.ok(!ids.includes(bob.entry.id))
	})
})
