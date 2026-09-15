import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../identity/User.js'
import { Identity } from '../../identity/Identity.js'
import { Source } from '../../sources/Source.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { Entry } from '../../entries/Entry.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { EntryType } from '../../entries/EntryType.js'
import { Integration } from '../../../integrations/Integration.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { GoogleCalendar } from '../../../integrations/google/GoogleCalendar.js'
import { AppleCalendar } from '../../../integrations/apple/AppleCalendar.js'
import { IcsSubscription } from '../../../integrations/ics/IcsSubscription.js'
import { Notion } from '../../../integrations/notion/Notion.js'
import { Tempo } from '../../../integrations/tempo/Tempo.js'
import { Dev } from '../../../integrations/dev/Dev.js'
import { NotificationSubscription } from '../../reminders/NotificationSubscription.js'
import { Session } from '../../identity/server/Session.js'
import { MigrationRefused } from './SourceMigration.js'
import { IcsImport } from './IcsImport.js'

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, IcsSubscription, Notion, Tempo, Dev, Source, Entry, EntryRelation, Recurrence, NotificationSubscription, Session],
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

function file(components: string) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Example//Exporter//EN',
		components.trim(),
		'END:VCALENDAR',
	].join('\r\n')
}

const EVENT = `BEGIN:VEVENT
UID:kickoff@example.com
SUMMARY:Kickoff
LOCATION:Room 1
DTSTART:20260901T100000Z
DTEND:20260901T110000Z
END:VEVENT`

const ALL_DAY = `BEGIN:VEVENT
UID:allday@example.com
SUMMARY:Company holiday
DTSTART;VALUE=DATE:20260914
DTEND;VALUE=DATE:20260915
END:VEVENT`

const TASK = `BEGIN:VTODO
UID:task@example.com
SUMMARY:Renew the domain
DTSTART;VALUE=DATE:20260901
DUE;VALUE=DATE:20260902
STATUS:NEEDS-ACTION
PERCENT-COMPLETE:25
END:VTODO`

const RELATED = `BEGIN:VEVENT
UID:review@example.com
SUMMARY:Review
DTSTART:20260902T100000Z
DTEND:20260902T110000Z
RELATED-TO;RELTYPE=FINISHTOSTART:kickoff@example.com
RELATED-TO:outside@example.com
END:VEVENT`

const SERIES = `BEGIN:VEVENT
UID:series@example.com
SUMMARY:Weekly sync
DTSTART:20260803T100000Z
DTEND:20260803T110000Z
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE:20260810T100000Z
END:VEVENT`

const SERIES_OVERRIDE = `BEGIN:VEVENT
UID:overridden@example.com
SUMMARY:Planning
DTSTART:20260804T100000Z
DTEND:20260804T110000Z
RRULE:FREQ=WEEKLY;COUNT=4
END:VEVENT
BEGIN:VEVENT
UID:overridden@example.com
RECURRENCE-ID:20260811T100000Z
SUMMARY:Planning (moved)
DTSTART:20260811T140000Z
DTEND:20260811T150000Z
END:VEVENT`

async function seed(em: EntityManager, init?: Partial<Source>) {
	const user = new User({ username: `importer-${crypto.randomUUID()}` })
	const integration = new Dev({ userId: user.id, uri: `mitra://test/${crypto.randomUUID()}` })
	const source = new Source({
		id: crypto.randomUUID(),
		integrationId: integration.id,
		uri: `mitra://test/${crypto.randomUUID()}/calendar`,
		name: 'Target',
		entryTypes: [EntryType.Event, EntryType.Task],
		enabled: true,
		...init,
	})
	em.persist([user, integration, source])
	await em.flush()
	return { user, integration, source }
}

describe('Calendar file import', () => {
	let orm: MikroORM
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('adds events and tasks with fresh identities, leaving nothing of the file behind', async () => {
		const em = orm.em.fork()
		const { user, source } = await seed(em)
		const icsImport = await IcsImport.of(em, user, source.id, file([EVENT, ALL_DAY, TASK].join('\r\n')))

		const plan = icsImport.plan()
		assert.equal(plan.total, 3)
		assert.equal(plan.cleanCount, 3)

		const outcome = await icsImport.run()
		assert.equal(outcome.created, 3)
		assert.equal(outcome.left, 0)
		assert.equal(outcome.aborted, false)

		const entries = await em.find(Entry, { sourceId: source.id })
		assert.equal(entries.length, 3)

		const kickoff = entries.find(entry => entry.heading === 'Kickoff')!
		assert.equal(kickoff.type.isEvent, true)
		assert.equal(kickoff.location, 'Room 1')
		assert.equal(kickoff.start!.getTime(), Date.UTC(2026, 8, 1, 10))
		assert.notEqual(kickoff.uid, 'kickoff@example.com')
		assert.equal(kickoff.data?.raw, undefined)

		const holiday = entries.find(entry => entry.heading === 'Company holiday')!
		assert.equal(holiday.allDay, true)

		const task = entries.find(entry => entry.heading === 'Renew the domain')!
		assert.equal(task.type.isTask, true)
		assert.equal(task.percentComplete, 25)
	})

	it('repoints in-file links onto the minted identities and leaves outside links alone', async () => {
		const em = orm.em.fork()
		const { user, source } = await seed(em)
		await (await IcsImport.of(em, user, source.id, file([EVENT, RELATED].join('\r\n')))).run()

		const entries = await em.find(Entry, { sourceId: source.id })
		const kickoff = entries.find(entry => entry.heading === 'Kickoff')!
		const review = entries.find(entry => entry.heading === 'Review')!

		const relations = await em.find(EntryRelation, { entryId: review.id! })
		assert.deepEqual(
			relations.map(row => row.targetUid).sort(),
			[kickoff.uid!, 'outside@example.com'].sort(),
		)
	})

	it('carries the rule and its exclusions without persisting the file as sync state', async () => {
		const em = orm.em.fork()
		const { user, source } = await seed(em)
		await (await IcsImport.of(em, user, source.id, file(SERIES))).run()

		const [series] = await em.find(Entry, { sourceId: source.id })
		assert.equal(series!.recurrence?.freq, 'WEEKLY')
		assert.deepEqual(series!.exdates, [Date.UTC(2026, 7, 10, 10)])
		assert.equal(series!.data?.raw, undefined)
	})

	it('leaves a series with edited occurrences out instead of flattening it silently', async () => {
		const em = orm.em.fork()
		const { user, source } = await seed(em)
		const icsImport = await IcsImport.of(em, user, source.id, file(SERIES_OVERRIDE))

		const plan = icsImport.plan()
		assert.equal(plan.total, 1)
		assert.deepEqual(plan.verdicts[0]!.blockers, ['occurrence'])

		const outcome = await icsImport.run()
		assert.equal(outcome.created, 0)
		assert.equal(outcome.left, 1)
		assert.equal(await em.count(Entry, { sourceId: source.id }), 0)
	})

	it('reports the type conversion of a task landing in an events-only calendar', async () => {
		const em = orm.em.fork()
		const { user, source } = await seed(em, { entryTypes: [EntryType.Event] })
		const icsImport = await IcsImport.of(em, user, source.id, file(TASK))

		assert.deepEqual(icsImport.plan().verdicts[0]!.losses, ['type'])

		await icsImport.run()
		const [entry] = await em.find(Entry, { sourceId: source.id })
		assert.equal(entry!.type.isEvent, true)
	})

	it('refuses read-only targets and files that are not calendars', async () => {
		const em = orm.em.fork()
		const { user, source } = await seed(em, { readOnly: true })
		await assert.rejects(() => IcsImport.of(em, user, source.id, file(EVENT)), MigrationRefused)

		const { user: user2, source: source2 } = await seed(em)
		await assert.rejects(() => IcsImport.of(em, user2, source2.id, 'not a calendar'), MigrationRefused)
		await assert.rejects(() => IcsImport.of(em, user2, source2.id, ''), MigrationRefused)
		await assert.rejects(() => IcsImport.of(em, user2, source2.id, file('')), MigrationRefused)
	})

	it('takes back what already landed when the target fails halfway', async () => {
		const em = orm.em.fork()
		const { user, integration, source } = await seed(em)
		let creations = 0
		const original = integration.createEntry.bind(integration)
		integration.createEntry = (em2, entry) => ++creations === 2 ? Promise.reject(new Error('provider down')) : original(em2, entry)

		const outcome = await (await IcsImport.of(em, user, source.id, file([EVENT, RELATED].join('\r\n')))).run()

		assert.equal(outcome.aborted, true)
		assert.equal(outcome.failure, 'provider down')
		assert.equal(outcome.left, 2)
		assert.equal(await em.count(Entry, { sourceId: source.id }), 0)
	})
})
