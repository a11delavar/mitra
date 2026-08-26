import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { entity } from '../../../infrastructure/model/orm.js'
import { Integration } from '../../../integrations/Integration.js'
import { Dev } from '../../../integrations/dev/Dev.js'
import { Notion } from '../../../integrations/notion/Notion.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { GoogleCalendar } from '../../../integrations/google/GoogleCalendar.js'
import { AppleCalendar } from '../../../integrations/apple/AppleCalendar.js'
import { Identity } from '../../identity/Identity.js'
import { Session } from '../../identity/server/Session.js'
import { User } from '../../identity/User.js'
import { Entry, TaskStatus, Transparency } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { RelationType } from '../../relations/RelationType.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { NotificationSubscription } from '../../reminders/NotificationSubscription.js'
import { Source } from '../../sources/Source.js'
import { SourceMigration, MigrationRefused } from './SourceMigration.js'

type DateTime = import('@3mo/date-time').DateTime
const D = (iso: string) => new Date(iso) as unknown as DateTime

/** Test double simulating a target that assigns its own UID (e.g. Notion page ID). */
@entity({ discriminatorValue: 'test-minting' })
class Minting extends Dev {
	override createEntry(em: EntityManager, entry: Entry) {
		entry.uid = `minted-${entry.uid}`
		return super.createEntry(em, entry)
	}
}

/** Test double with restricted capabilities. */
@entity({ discriminatorValue: 'test-limited' })
class Limited extends Dev {
	override get capabilities() {
		return { ...Integration.fullCapabilities, recurrence: false, reminders: false, participants: false }
	}
}

/** Test double that throws when entry heading is 'poison'. */
@entity({ discriminatorValue: 'test-failing' })
class Failing extends Dev {
	override createEntry(em: EntityManager, entry: Entry) {
		if (entry.heading === 'poison') {
			throw new Error('the provider said no')
		}
		return super.createEntry(em, entry)
	}
}

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Notion, Dev, Minting, Limited, Failing, Source, Entry, EntryRelation, Recurrence, NotificationSubscription, Session],
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

/** Seeds a user with origin and target sources on separate integrations. */
async function seed(em: EntityManager, TargetIntegration: typeof Dev = Dev) {
	const user = new User({ username: 'owner' })
	const from = new Dev({ userId: user.id, uri: 'dev://origin' })
	const to = new TargetIntegration({ userId: user.id, uri: 'dev://target' })
	const origin = new Source({ integrationId: from.id, uri: 'origin/calendar', name: 'Origin', enabled: true })
	const target = new Source({ integrationId: to.id, uri: 'target/calendar', name: 'Target', enabled: true })
	em.persist([user, from, to, origin, target])
	await em.flush()
	return { user, origin, target }
}

function entryIn(source: Source, init: Partial<Entry> = {}) {
	return new Entry({
		id: crypto.randomUUID(),
		uid: crypto.randomUUID(),
		sourceId: source.id,
		type: EntryType.Event,
		heading: 'Entry',
		start: D('2026-09-01T09:00:00Z'),
		end: D('2026-09-01T10:00:00Z'),
		...init,
	})
}

describe('SourceMigration', () => {
	let orm: MikroORM
	let em: EntityManager

	beforeEach(async () => {
		orm = await inMemoryOrm()
		em = orm.em.fork() as EntityManager
	})

	afterEach(async () => {
		await orm.close(true)
	})

	describe('the fidelity preview', () => {
		it('names only the entries with something to say, and counts the rest as clean', async () => {
			const { user, origin, target } = await seed(em, Limited)
			em.persist([
				entryIn(origin, { heading: 'clean' }),
				entryIn(origin, { heading: 'noisy', reminders: [30] }),
			])
			await em.flush()

			const plan = (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).plan()

			assert.equal(plan.total, 2)
			assert.equal(plan.cleanCount, 1)
			assert.deepEqual(plan.verdicts.map(verdict => verdict.heading), ['noisy'])
			assert.deepEqual(plan.losses, [['reminders', 1]])
		})

		it('refuses what the per-entry route would refuse, one line per reason', async () => {
			const { user, origin, target } = await seed(em, Limited)
			em.persist([
				entryIn(origin, { heading: 'weekly', recurrence: Recurrence.fromRRule('FREQ=WEEKLY;COUNT=3') }),
				entryIn(origin, { heading: 'meeting', participants: [{ email: 'organizer@example.com' }] as never }),
			])
			await em.flush()

			const plan = (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).plan()

			assert.equal(plan.movingCount(false), 0)
			assert.deepEqual(plan.blockers(false).map(([blocker]) => blocker).sort(), ['participants', 'recurrence'])
		})

		it('counts what a series would become, so the flatten choice can state its price', async () => {
			const { user, origin, target } = await seed(em, Limited)
			em.persist(entryIn(origin, { heading: 'weekly', recurrence: Recurrence.fromRRule('FREQ=WEEKLY;COUNT=3') }))
			await em.flush()

			const plan = (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).plan()

			assert.deepEqual(plan.flattenable.map(verdict => verdict.occurrences), [3])
			assert.equal(plan.movingCount(true), 1, 'the series moves once flattening is chosen')
			assert.equal(plan.creations(true), 3, 'and arrives as three single entries')
		})

		it('holds a series back when its own edited occurrences could not follow it', async () => {
			const { user, origin, target } = await seed(em)
			const master = entryIn(origin, { heading: 'standup', recurrence: Recurrence.fromRRule('FREQ=DAILY;COUNT=5') })
			em.persist([master, entryIn(origin, { heading: 'standup', recurrenceMasterId: master.id, recurrenceId: D('2026-09-02T09:00:00Z') })])
			await em.flush()

			const plan = (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).plan()

			// Both of them: the override shares the master's UID, and neither may land alone.
			assert.equal(plan.movingCount(false), 0)
			assert.deepEqual(plan.blockers(false), [['occurrence', 2]])
		})

		it('reads a full-capability target as no reason to hold anything back', async () => {
			const { user, origin, target } = await seed(em)
			em.persist([
				entryIn(origin, { heading: 'weekly', recurrence: Recurrence.fromRRule('FREQ=WEEKLY;COUNT=3') }),
				entryIn(origin, { heading: 'free', transparency: Transparency.Free }),
				entryIn(origin, { heading: 'done', type: EntryType.Task, status: TaskStatus.Cancelled }),
			])
			await em.flush()

			const plan = (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).plan()

			assert.equal(plan.total, 3)
			assert.equal(plan.cleanCount, 3)
			assert.equal(plan.movingCount(false), 3)
		})
	})

	describe('refusals that stop the whole batch', () => {
		it('will not move entries into the calendar they are already in', async () => {
			const { user, origin } = await seed(em)
			await assert.rejects(() => SourceMigration.of(em, user, origin.id, { targetSourceId: origin.id }), MigrationRefused)
		})

		it('will not move out of a read-only calendar — the originals could never be deleted', async () => {
			const { user, origin, target } = await seed(em)
			origin.readOnly = true
			await em.flush()
			await assert.rejects(() => SourceMigration.of(em, user, origin.id, { targetSourceId: target.id }), MigrationRefused)
		})

		it('will still COPY out of a read-only calendar — a copy asks nothing of the origin', async () => {
			const { user, origin, target } = await seed(em)
			origin.readOnly = true
			await em.flush()
			await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id, keepOriginals: true })
		})

		it('will not move into a read-only calendar', async () => {
			const { user, origin, target } = await seed(em)
			target.readOnly = true
			await em.flush()
			await assert.rejects(() => SourceMigration.of(em, user, origin.id, { targetSourceId: target.id }), MigrationRefused)
		})
	})

	describe('running the three phases', () => {
		it('copies everything over and only then empties the origin', async () => {
			const { user, origin, target } = await seed(em)
			em.persist([entryIn(origin, { heading: 'one' }), entryIn(origin, { heading: 'two' })])
			await em.flush()

			const outcome = await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).run()

			assert.equal(outcome.moved, 2)
			assert.equal(outcome.created, 2)
			assert.equal(outcome.failure, null)
			assert.equal(await em.count(Entry, { sourceId: origin.id }), 0)
			assert.deepEqual((await em.find(Entry, { sourceId: target.id })).map(entry => entry.heading).sort(), ['one', 'two'])
		})

		it('carries the identity, so a relationship between two moved entries survives', async () => {
			const { user, origin, target } = await seed(em)
			const [predecessor, dependent] = [entryIn(origin, { heading: 'first' }), entryIn(origin, { heading: 'second' })]
			em.persist([predecessor, dependent, new EntryRelation({ entryId: dependent.id!, type: RelationType.FinishToStart, targetUid: predecessor.uid! })])
			await em.flush()

			await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).run()

			const moved = await em.find(Entry, { sourceId: target.id })
			const rows = await em.find(EntryRelation, {})
			assert.equal(rows.length, 1)
			assert.equal(rows[0]!.targetUid, predecessor.uid, 'the uid travels with the entry, so the link still resolves')
			assert.equal(rows[0]!.entryId, moved.find(entry => entry.heading === 'second')!.id)
		})

		it('repoints the links when the target mints its own identities', async () => {
			const { user, origin, target } = await seed(em, Minting)
			const [predecessor, dependent] = [entryIn(origin, { heading: 'first' }), entryIn(origin, { heading: 'second' })]
			em.persist([predecessor, dependent, new EntryRelation({ entryId: dependent.id!, type: RelationType.FinishToStart, targetUid: predecessor.uid! })])
			await em.flush()

			await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).run()

			const rows = await em.find(EntryRelation, {}, { refresh: true })
			assert.equal(rows.length, 1)
			assert.equal(rows[0]!.targetUid, `minted-${predecessor.uid}`, 'the link follows the entry to its new identity')
		})

		it('leaves a relationship pointing outside the batch exactly as it was', async () => {
			const { user, origin, target } = await seed(em, Minting)
			const dependent = entryIn(origin, { heading: 'second' })
			em.persist([dependent, new EntryRelation({ entryId: dependent.id!, type: RelationType.FinishToStart, targetUid: 'somewhere-else' })])
			await em.flush()

			await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).run()

			const rows = await em.find(EntryRelation, {}, { refresh: true })
			assert.equal(rows[0]!.targetUid, 'somewhere-else', 'cross-source links are legal, and dangling is by design')
		})

		it('leaves the entries the plan refuses right where they are', async () => {
			const { user, origin, target } = await seed(em, Limited)
			em.persist([
				entryIn(origin, { heading: 'plain' }),
				entryIn(origin, { heading: 'weekly', recurrence: Recurrence.fromRRule('FREQ=WEEKLY;COUNT=3') }),
			])
			await em.flush()

			const outcome = await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).run()

			assert.equal(outcome.moved, 1)
			assert.equal(outcome.left, 1)
			assert.deepEqual((await em.find(Entry, { sourceId: origin.id })).map(entry => entry.heading), ['weekly'])
		})

		it('writes a flattened series out as single entries when the run says so', async () => {
			const { user, origin, target } = await seed(em, Limited)
			em.persist(entryIn(origin, {
				heading: 'weekly',
				recurrence: Recurrence.fromRRule('FREQ=WEEKLY;COUNT=3'),
				start: D('2026-09-01T09:00:00Z'),
				end: D('2026-09-01T10:00:00Z'),
			}))
			await em.flush()

			const outcome = await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id, flatten: true })).run()

			const moved = await em.find(Entry, { sourceId: target.id })
			assert.equal(outcome.created, 3)
			assert.equal(moved.length, 3)
			assert.ok(moved.every(entry => !entry.recurrence?.freq), 'a flattened occurrence no longer repeats')
			assert.deepEqual([...new Set(moved.map(entry => entry.uid))].length, 3, 'each occurrence gets an identity of its own')
			assert.equal(await em.count(Entry, { sourceId: origin.id }), 0)
		})

		it('does not resurrect an occurrence that was deleted from the series', async () => {
			const { user, origin, target } = await seed(em, Limited)
			em.persist(entryIn(origin, {
				heading: 'weekly',
				recurrence: Recurrence.fromRRule('FREQ=WEEKLY;COUNT=3'),
				exdates: [new Date('2026-09-08T09:00:00Z').getTime()],
			}))
			await em.flush()

			const outcome = await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id, flatten: true })).run()

			assert.equal(outcome.created, 2)
		})

		it('keeps the originals — and gives their copies identities of their own — when asked to copy', async () => {
			const { user, origin, target } = await seed(em)
			const original = entryIn(origin, { heading: 'one' })
			em.persist(original)
			await em.flush()

			const outcome = await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id, keepOriginals: true })).run()

			assert.equal(outcome.created, 1)
			assert.equal(outcome.moved, 0, 'nothing left the origin')
			assert.equal(await em.count(Entry, { sourceId: origin.id }), 1)
			const [copy] = await em.find(Entry, { sourceId: target.id })
			assert.equal(copy!.heading, 'one')
			assert.notEqual(copy!.uid, original.uid, 'two entries answering to one identity would make every link to it ambiguous')
		})

		it('copies a linked PAIR as a linked pair — the copies point at each other, never back at the originals', async () => {
			const { user, origin, target } = await seed(em)
			const [predecessor, dependent] = [entryIn(origin, { heading: 'first' }), entryIn(origin, { heading: 'second' })]
			em.persist([predecessor, dependent, new EntryRelation({ entryId: dependent.id!, type: RelationType.FinishToStart, targetUid: predecessor.uid! })])
			await em.flush()

			await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id, keepOriginals: true })).run()

			const copies = await em.find(Entry, { sourceId: target.id }, { refresh: true })
			const copyOf = (heading: string) => copies.find(entry => entry.heading === heading)!
			const rows = await em.find(EntryRelation, {}, { refresh: true })
			const copied = rows.find(row => row.entryId === copyOf('second').id)
			assert.ok(copied, 'the copy carries the link')
			assert.equal(copied.targetUid, copyOf('first').uid, 'and it points at the OTHER copy, not at the original')
			const stayed = rows.find(row => row.entryId === dependent.id)
			assert.equal(stayed!.targetUid, predecessor.uid, 'the originals go on pointing at each other')
		})

		it('leaves a copied link that pointed OUT of the batch pointing where it did', async () => {
			const { user, origin, target } = await seed(em)
			const dependent = entryIn(origin, { heading: 'second' })
			em.persist([dependent, new EntryRelation({ entryId: dependent.id!, type: RelationType.FinishToStart, targetUid: 'somewhere-else' })])
			await em.flush()

			await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id, keepOriginals: true })).run()

			const [copy] = await em.find(Entry, { sourceId: target.id }, { refresh: true })
			const rows = await em.find(EntryRelation, {}, { refresh: true })
			assert.equal(rows.find(row => row.entryId === copy!.id)!.targetUid, 'somewhere-else')
		})

		it('never rewrites a link that an ORIGINAL owns when copying, whatever the target mints', async () => {
			const { user, origin, target } = await seed(em, Minting)
			const [predecessor, dependent] = [entryIn(origin, { heading: 'first' }), entryIn(origin, { heading: 'second' })]
			em.persist([predecessor, dependent, new EntryRelation({ entryId: dependent.id!, type: RelationType.FinishToStart, targetUid: predecessor.uid! })])
			await em.flush()

			await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id, keepOriginals: true })).run()

			const rows = await em.find(EntryRelation, {}, { refresh: true })
			const pointing = rows.filter(row => row.entryId === dependent.id)
			assert.deepEqual(pointing.map(row => row.targetUid), [predecessor.uid], 'the original is still there under that uid — nothing to repoint')
		})

		it('aborts before deleting anything when a copy fails, and takes its copies back', async () => {
			const { user, origin, target } = await seed(em, Failing)
			em.persist([entryIn(origin, { heading: 'fine' }), entryIn(origin, { heading: 'poison' })])
			await em.flush()

			const outcome = await (await SourceMigration.of(em, user, origin.id, { targetSourceId: target.id })).run()

			assert.equal(outcome.aborted, true)
			assert.equal(outcome.failedEntry, 'poison')
			assert.equal(outcome.moved, 0)
			assert.equal(outcome.duplicates, 0)
			assert.equal(await em.count(Entry, { sourceId: origin.id }), 2, 'nothing is deleted before every copy has landed')
			assert.equal(await em.count(Entry, { sourceId: target.id }), 0, 'and the copies already made are taken back')
		})
	})
})
