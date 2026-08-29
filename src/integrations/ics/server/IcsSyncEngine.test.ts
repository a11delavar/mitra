import { describe, it, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../../features/identity/User.js'
import { Identity } from '../../../features/identity/Identity.js'
import { Source } from '../../../features/sources/Source.js'
import { Recurrence } from '../../../features/recurrence/Recurrence.js'
import { Entry, TaskStatus, FLOATING_TIME_ZONE } from '../../../features/entries/Entry.js'
import { EntryRelation } from '../../../features/relations/EntryRelation.js'
import { EntryType } from '../../../features/entries/EntryType.js'
import { Integration, registerEngine } from '../../Integration.js'
import { CalDAV } from '../../caldav/CalDAV.js'
import { GoogleCalendar } from '../../google/GoogleCalendar.js'
import { AppleCalendar } from '../../apple/AppleCalendar.js'
import { Notion } from '../../notion/Notion.js'
import { Tempo } from '../../tempo/Tempo.js'
import { Dev } from '../../dev/Dev.js'
import { NotificationSubscription } from '../../../features/reminders/NotificationSubscription.js'
import { Session } from '../../../features/identity/server/Session.js'
import { IcsSubscription } from '../IcsSubscription.js'
import { IcsSyncEngine } from './IcsSyncEngine.js'

const FEED_URL = 'https://example.com/calendar.ics'
const BERLIN = 'Europe/Berlin'

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

const BERLIN_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`

const WINDOWS_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:W. Europe Standard Time
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:16011028T030000
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10
END:STANDARD
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:16010325T020000
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
END:VTIMEZONE`

function feed(components: string, { name = 'Team Holidays', color = '#FF5733' } = {}) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Example//Publisher//EN',
		...name ? [`X-WR-CALNAME:${name}`] : [],
		...color ? [`X-APPLE-CALENDAR-COLOR:${color}`] : [],
		BERLIN_VTIMEZONE,
		WINDOWS_VTIMEZONE,
		components.trim(),
		'END:VCALENDAR',
	].join('\r\n')
}

const ZONED = `BEGIN:VEVENT
UID:zoned@example.com
SUMMARY:Zoned standup
LOCATION:Room 1
DTSTART;TZID=Europe/Berlin:20260810T090000
DTEND;TZID=Europe/Berlin:20260810T093000
END:VEVENT`

const ALL_DAY = `BEGIN:VEVENT
UID:allday@example.com
SUMMARY:Company holiday
DTSTART;VALUE=DATE:20260814
DTEND;VALUE=DATE:20260815
END:VEVENT`

const FLOATING = `BEGIN:VEVENT
UID:floating@example.com
SUMMARY:Floating reminder
DTSTART:20260812T140000
DTEND:20260812T150000
END:VEVENT`

const WINDOWS_ZONED = `BEGIN:VEVENT
UID:outlook@example.com
SUMMARY:Outlook meeting
DTSTART;TZID=W. Europe Standard Time:20260811T110000
DTEND;TZID=W. Europe Standard Time:20260811T120000
END:VEVENT`

const SERIES = `BEGIN:VEVENT
UID:series@example.com
SUMMARY:Weekly sync
DTSTART;TZID=Europe/Berlin:20260803T100000
DTEND;TZID=Europe/Berlin:20260803T110000
RRULE:FREQ=WEEKLY;COUNT=4
END:VEVENT`

const SERIES_OVERRIDE = `BEGIN:VEVENT
UID:series@example.com
RECURRENCE-ID;TZID=Europe/Berlin:20260810T100000
SUMMARY:Weekly sync (moved)
DTSTART;TZID=Europe/Berlin:20260810T140000
DTEND;TZID=Europe/Berlin:20260810T150000
END:VEVENT`

const TASK = `BEGIN:VTODO
UID:task@example.com
SUMMARY:Renew the domain
DTSTART;VALUE=DATE:20260901
DUE;VALUE=DATE:20260902
STATUS:NEEDS-ACTION
PERCENT-COMPLETE:25
END:VTODO`

const JOURNAL = `BEGIN:VJOURNAL
UID:journal@example.com
SUMMARY:Not a thing mitra models
END:VJOURNAL`

const FULL_FEED = feed([ZONED, ALL_DAY, FLOATING, WINDOWS_ZONED, SERIES, SERIES_OVERRIDE, TASK, JOURNAL].join('\r\n'))

interface Served {
	body?: string
	status?: number
	headers?: Record<string, string>
}

function serveFeed(...responses: Array<Served>) {
	const requests = new Array<{ url: string, headers: Record<string, string> }>()
	let index = 0
	const original = globalThis.fetch
	globalThis.fetch = ((input: string | URL, init?: RequestInit) => {
		const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>))
		requests.push({ url: String(input), headers })
		const served = responses[Math.min(index++, responses.length - 1)] ?? {}
		const status = served.status ?? 200
		const body = status === 304 || status === 204 ? null : served.body ?? FULL_FEED
		return Promise.resolve(new Response(body, { status, headers: served.headers ?? { etag: '"v1"' } }))
	}) as typeof globalThis.fetch
	return { requests, restore: () => { globalThis.fetch = original } }
}

const engine = new IcsSyncEngine()
registerEngine('ics', engine)

async function seed(em: EntityManager, init?: Partial<IcsSubscription['credentials']>) {
	const user = new User({ username: `subscriber-${crypto.randomUUID()}` })
	const integration = new IcsSubscription({ userId: user.id, uri: FEED_URL, credentials: { username: '', ...init } })
	em.persist([user, integration])
	await em.flush()
	return integration
}

async function poll(em: EntityManager, integration: IcsSubscription) {
	integration.feed = undefined
	const [source] = await integration.getSources(em)
	source!.enabled = true
	await em.flush()
	const changed = await engine.syncSourceEntries(integration, em, source!)
	await em.flush()
	return { source: source!, changed, entries: await em.find(Entry, { sourceId: source!.id }) }
}

describe('Calendar subscription discovery', () => {
	let orm: MikroORM
	let served: ReturnType<typeof serveFeed>
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })
	beforeEach(() => { served = serveFeed() })
	afterEach(() => served.restore())

	it('names the calendar and the account from the feed itself', async () => {
		const em = orm.em.fork()
		const integration = await seed(em)
		const sources = await engine.fetchSources(integration)

		assert.equal(integration.credentials.username, 'Team Holidays')
		assert.equal(sources.length, 1)
		assert.equal(sources[0]!.name, 'Team Holidays')
		assert.equal(sources[0]!.color, '#FF5733')
		assert.equal(sources[0]!.uri, FEED_URL)
		assert.equal(sources[0]!.enabled, false)
		assert.deepEqual([...sources[0]!.entryTypes], [EntryType.Event, EntryType.Task])
	})

	it('falls back to the file name when the calendar never says what it is called', async () => {
		served.restore()
		served = serveFeed({ body: feed(ZONED, { name: '', color: '' }) })
		const em = orm.em.fork()
		const integration = await seed(em)
		integration.uri = 'https://example.com/feeds/Public%20Holidays.ics'
		const sources = await engine.fetchSources(integration)

		assert.equal(sources[0]!.name, 'Public Holidays')
		assert.deepEqual([...sources[0]!.entryTypes], [EntryType.Event])
	})

	it('rewrites a pasted webcal link before the duplicate check reads it as the account identity', async () => {
		const em = orm.em.fork()
		const integration = await seed(em)
		integration.uri = 'webcal://example.com/calendar.ics'
		await engine.fetchSources(integration)

		assert.equal(integration.uri, FEED_URL)
		assert.equal(served.requests[0]!.url, FEED_URL)
	})

	it('sends Basic auth only for a feed that was given credentials', async () => {
		const em = orm.em.fork()
		await engine.fetchSources(await seed(em))
		assert.equal(served.requests[0]!.headers.authorization, undefined)

		const withPassword = await seed(em, { authUsername: 'reader', password: 'secret' })
		await engine.fetchSources(withPassword)
		assert.equal(served.requests[1]!.headers.authorization, `Basic ${Buffer.from('reader:secret').toString('base64')}`)
	})

	it('explains a locked feed rather than reporting a bare status', async () => {
		served.restore()
		served = serveFeed({ status: 401 })
		await assert.rejects(() => engine.fetchSources(transient()), /username and password/)
	})

	it('says plainly that nothing is there, rather than echoing a bare status', async () => {
		served.restore()
		served = serveFeed({ status: 404 })
		await assert.rejects(() => engine.fetchSources(transient()), /No calendar was found at that address/)
	})

	it('refuses an address that answers with something other than a calendar', async () => {
		served.restore()
		served = serveFeed({ body: '<!doctype html><title>Not a calendar</title>' })
		await assert.rejects(() => engine.fetchSources(transient()), /did not return a calendar/)
	})

	it('refuses a link it could never fetch, before any request goes out', async () => {
		await assert.rejects(() => engine.fetchSources(transient('not a url')), /calendar address/)
		assert.equal(served.requests.length, 0)
	})
})

function transient(uri = FEED_URL) {
	return new IcsSubscription({ userId: crypto.randomUUID(), uri, credentials: { username: '' } })
}

describe('Calendar subscription sync', () => {
	let orm: MikroORM
	let served: ReturnType<typeof serveFeed>
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })
	afterEach(() => served?.restore())

	it('imports every component it models and skips the ones it does not', async () => {
		served = serveFeed()
		const em = orm.em.fork()
		const integration = await seed(em)
		const { entries, changed } = await poll(em, integration)

		assert.equal(changed, true)
		assert.deepEqual(entries.map(entry => entry.uri).sort(), [
			'allday@example.com', 'floating@example.com', 'outlook@example.com',
			'series@example.com', 'series@example.com', 'task@example.com', 'zoned@example.com',
		])

		const zoned = entries.find(entry => entry.uri === 'zoned@example.com')!
		assert.equal(zoned.heading, 'Zoned standup')
		assert.equal(zoned.location, 'Room 1')
		assert.equal(zoned.timeZone, BERLIN)
		assert.equal(zoned.start!.toISOString(), '2026-08-10T07:00:00.000Z')
		assert.equal(zoned.type, EntryType.Event)

		const allDay = entries.find(entry => entry.uri === 'allday@example.com')!
		assert.equal(allDay.allDay, true)
		assert.equal(allDay.start!.getTime(), Date.UTC(2026, 7, 14))

		const floating = entries.find(entry => entry.uri === 'floating@example.com')!
		assert.equal(floating.timeZone, FLOATING_TIME_ZONE)

		const task = entries.find(entry => entry.uri === 'task@example.com')!
		assert.equal(task.type, EntryType.Task)
		assert.equal(task.status, TaskStatus.ToDo)
		assert.equal(task.percentComplete, 25)
	})

	it('resolves a Microsoft zone name through the feed\'s own VTIMEZONE, storing no zone it could not expand', async () => {
		served = serveFeed()
		const em = orm.em.fork()
		const { entries } = await poll(em, await seed(em))

		const outlook = entries.find(entry => entry.uri === 'outlook@example.com')!
		assert.equal(outlook.timeZone, null)
		assert.equal(outlook.start!.toISOString(), '2026-08-11T09:00:00.000Z')
	})

	it('links a single edited occurrence back to its series master', async () => {
		served = serveFeed()
		const em = orm.em.fork()
		const { entries } = await poll(em, await seed(em))

		const master = entries.find(entry => entry.uri === 'series@example.com' && !entry.recurrenceId)!
		const override = entries.find(entry => entry.uri === 'series@example.com' && entry.recurrenceId)!
		assert.ok(master.recurrence)
		assert.equal(override.recurrenceMasterId, master.id)
		assert.equal(override.heading, 'Weekly sync (moved)')
	})

	it('asks the next poll conditionally and reports nothing when the server answers 304', async () => {
		served = serveFeed({ headers: { etag: '"v1"', 'last-modified': 'Mon, 10 Aug 2026 06:00:00 GMT' } }, { status: 304 })
		const em = orm.em.fork()
		const integration = await seed(em)
		const first = await poll(em, integration)
		assert.equal(first.changed, true)

		const second = await poll(em, integration)
		assert.equal(second.changed, false)
		assert.equal(second.entries.length, first.entries.length)
		assert.equal(served.requests[1]!.headers['if-none-match'], '"v1"')
		assert.equal(served.requests[1]!.headers['if-modified-since'], 'Mon, 10 Aug 2026 06:00:00 GMT')
	})

	it('stays silent when a server without validators re-serves an identical body', async () => {
		served = serveFeed({ headers: {} })
		const em = orm.em.fork()
		const integration = await seed(em)
		assert.equal((await poll(em, integration)).changed, true)
		assert.equal((await poll(em, integration)).changed, false)
	})

	it('reports an edit to one entity without touching the rest', async () => {
		const edited = FULL_FEED.replace('SUMMARY:Zoned standup', 'SUMMARY:Zoned standup (renamed)')
		served = serveFeed({ headers: {} }, { body: edited, headers: {} })
		const em = orm.em.fork()
		const integration = await seed(em)
		const first = await poll(em, integration)
		const before = first.entries.find(entry => entry.uri === 'allday@example.com')!.id

		const second = await poll(em, integration)
		assert.equal(second.changed, true)
		assert.equal(second.entries.find(entry => entry.uri === 'zoned@example.com')!.heading, 'Zoned standup (renamed)')
		assert.equal(second.entries.find(entry => entry.uri === 'allday@example.com')!.id, before)
	})

	it('removes what the feed no longer carries', async () => {
		const without = feed([ALL_DAY, FLOATING, WINDOWS_ZONED, SERIES, SERIES_OVERRIDE, TASK].join('\r\n'))
		served = serveFeed({ headers: {} }, { body: without, headers: {} })
		const em = orm.em.fork()
		const integration = await seed(em)
		await poll(em, integration)

		const { changed, entries } = await poll(em, integration)
		assert.equal(changed, true)
		assert.equal(entries.some(entry => entry.uri === 'zoned@example.com'), false)
		assert.equal(entries.length, 6)
	})

	it('drops an override whose occurrence was reverted to the series, keeping the master', async () => {
		const reverted = feed([ZONED, ALL_DAY, FLOATING, WINDOWS_ZONED, SERIES, TASK].join('\r\n'))
		served = serveFeed({ headers: {} }, { body: reverted, headers: {} })
		const em = orm.em.fork()
		const integration = await seed(em)
		await poll(em, integration)

		const { entries } = await poll(em, integration)
		const series = entries.filter(entry => entry.uri === 'series@example.com')
		assert.equal(series.length, 1)
		assert.ok(!series[0]!.recurrenceId)
		assert.ok(series[0]!.recurrence)
	})

	it('imports a component with no UID under a stable identity of its own, rather than dropping it', async () => {
		const uidless = feed(`BEGIN:VEVENT
SUMMARY:Broken but real
DTSTART;TZID=Europe/Berlin:20260810T090000
DTEND;TZID=Europe/Berlin:20260810T093000
END:VEVENT`)
		served = serveFeed({ body: uidless, headers: {} })
		const em = orm.em.fork()
		const integration = await seed(em)
		const first = await poll(em, integration)
		assert.equal(first.entries.length, 1)
		assert.equal(first.entries[0]!.heading, 'Broken but real')

		const second = await poll(em, integration)
		assert.equal(second.entries.length, 1)
		assert.equal(second.entries[0]!.id, first.entries[0]!.id)
	})

	it('rebuilds the calendar from scratch on a re-import', async () => {
		served = serveFeed({ headers: {} })
		const em = orm.em.fork()
		const integration = await seed(em)
		const { source, entries } = await poll(em, integration)

		integration.feed = undefined
		await integration.reimportSource(em, source)
		const rebuilt = await em.find(Entry, { sourceId: source.id })
		assert.equal(rebuilt.length, entries.length)
		assert.equal(rebuilt.every(entry => entries.every(before => before.id !== entry.id)), true)
	})
})

describe('Calendar subscription writes', () => {
	it('refuses writes', () => {
		assert.throws(() => engine.createEntry(), /read-only/)
		assert.throws(() => engine.updateEntry(), /read-only/)
		assert.throws(() => engine.deleteEntry(), /read-only/)
		assert.throws(() => engine.excludeOccurrence(), /read-only/)
	})
})
