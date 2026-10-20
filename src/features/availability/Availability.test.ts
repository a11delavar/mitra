import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { children } from '#infrastructure/model'
import { DateTime } from '@3mo/date-time'
import { User, Identity } from '#features/identity'
import { Session } from '#features/identity/server/Session.js'
import { Source } from '#features/sources'
import { Recurrence, RecurrenceFrequency } from '#features/recurrence'
import { Entry, TaskStatus, Transparency, EntryType, EntryTypes } from '#features/entries'
import { EntryRelation, EntryRelations, RelationGraph, RelationType } from '#features/relations'
import { NotificationSubscription } from '#features/reminders/NotificationSubscription.js'
import { MigrationVerdict } from '#features/migration/MigrationPlan.js'
import { Integration, registerEngine, type SyncEngine } from '#integrations'
import { CalDAV } from '#integrations/caldav/CalDAV.js'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import { Notion } from '#integrations/notion/Notion.js'
import { Tempo } from '#integrations/tempo/Tempo.js'
import { Availability } from './client/Availability.js'

/** A one-off entry as the views get it. */
const shown = (entry: Entry) => entry.occurrences.single

describe('the availability type', () => {
	it('parses from its wire value', () => {
		assert.equal(EntryType.parse('availability'), EntryType.Availability)
		assert.equal(EntryType.Availability.isAvailability, true)
		assert.equal(EntryType.Availability.isEvent, false)
		assert.equal(EntryType.Availability.isTask, false)
	})

	it('fits any calendar, whatever its provider stores', () => {
		for (const entryTypes of [[], [EntryType.Event], [EntryType.Task]]) {
			assert.equal(new Source({ entryTypes: EntryTypes.of(...entryTypes) }).supportsEntryType(EntryType.Availability), true)
		}
		assert.equal(new Source({ entryTypes: EntryTypes.of(EntryType.Event) }).supportsEntryType(EntryType.Task), false)
	})

	it('lives wherever the provider takes part', () => {
		const source = new Source({ entryTypes: EntryTypes.of(EntryType.Event) })
		assert.equal(new CalDAV().canHold(source, EntryType.Availability), true)
		assert.equal(new MitraCalendar().canHold(source, EntryType.Availability), true)
		assert.equal(new Notion().canHold(source, EntryType.Availability), false)
		assert.equal(new Tempo().canHold(source, EntryType.Availability), false)
		assert.equal(new Notion().canHold(source, EntryType.Event), true)
	})

	it('shows as free unless marked busy, where an event defaults to busy', () => {
		assert.equal(new Entry({ type: EntryType.Availability }).showAs, Transparency.Free)
		assert.equal(new Entry({ type: EntryType.Availability, transparency: Transparency.Busy }).showAs, Transparency.Busy)
		assert.equal(new Entry({ type: EntryType.Event }).showAs, Transparency.Busy)
	})

	it('keeps its type when it moves to another calendar', () => {
		const entry = new Entry({ sourceId: 'a', type: EntryType.Availability })
		entry.migrateTo(new Source({ id: 'b', entryTypes: EntryTypes.of(EntryType.Task) }))
		assert.equal(entry.type, EntryType.Availability)
	})
})

describe('the availability labels of a day', () => {
	const slice = (start: number, end: number) => ({ startMinute: start * 60, endMinute: end * 60 })

	describe('labels', () => {
		it('are centred in a window of their own', () => {
			assert.deepEqual(Availability.labelPositions([slice(9, 12), slice(14, 17)]), [0.5, 0.5])
		})

		it('go to the start and the end of two windows sharing time, in the order of their middles', () => {
			// Deep work inside working hours takes the start, so the working hours' label at the end never meets it.
			assert.deepEqual(Availability.labelPositions([slice(9, 12), slice(9, 17)]), [0, 1])
			assert.deepEqual(Availability.labelPositions([slice(9, 17), slice(13, 18)]), [0, 1])
			// A short window late inside a long one takes the end, where ordering by end would have met the long one's label.
			assert.deepEqual(Availability.labelPositions([slice(9, 17), slice(15, 16)]), [0, 1])
		})

		it('spread out among three, the middle one centred', () => {
			assert.deepEqual(Availability.labelPositions([slice(9, 17), slice(10, 12), slice(16, 18)]), [0.5, 0, 1])
		})

		it('group windows through a chain of overlaps, even where the ends never meet', () => {
			assert.deepEqual(Availability.labelPositions([slice(9, 11), slice(10, 14), slice(13, 15), slice(16, 17)]), [0, 0.5, 1, 0.5])
		})
	})

	it('read the name and the place of a window, whichever it has', () => {
		assert.equal(Availability.labelOf({ heading: 'Study time', location: 'Library' }), 'Study time · Library')
		assert.equal(Availability.labelOf({ heading: '', location: ' Office ' }), 'Office')
		assert.equal(Availability.labelOf({ heading: ' ', location: '' }), '')
	})

	describe('of a day with an unlabelled window', () => {
		it('gives only the labelled windows a place among the labels', () => {
			const day = new DateTime('2026-10-07T00:00:00').dayStart
			const window = (id: string, heading: string, start: number, end: number) => shown(new Entry({
				id, uid: id, sourceId: 's', type: EntryType.Availability, heading, start: day.add({ hours: start }), end: day.add({ hours: end }), allDay: false,
			}))
			const placements = Availability.on([window('a', 'Working hours', 9, 17), window('b', '', 10, 12), window('c', 'Deep work', 9, 12)], day)
			assert.deepEqual(placements.map(({ segment, labelAt }) => [segment.entry.id, labelAt]), [['a', 1], ['b', 0.5], ['c', 0]])
		})
	})

	// A day handed its very list again is one lit skips: a drag elsewhere must not re-render every day of the week.
	it('gives a day its very list again where its windows did not change', () => {
		const monday = new DateTime('2026-10-05T00:00:00').dayStart
		const tuesday = monday.add({ days: 1 })
		const window = (id: string, day: DateTime) => shown(new Entry({ id, uid: id, sourceId: 's', type: EntryType.Availability, heading: id, start: day.add({ hours: 9 }), end: day.add({ hours: 17 }), allDay: false }))
		const [mondayWindow, tuesdayWindow] = [window('monday', monday), window('tuesday', tuesday)]
		const before = Availability.on([mondayWindow, tuesdayWindow], monday)
		const moved = shown(new Entry({ id: 'moved', sourceId: 's', type: EntryType.Event, heading: 'Moved', start: tuesday.add({ hours: 10 }), end: tuesday.add({ hours: 11 }) }))
		assert.equal(Availability.on([mondayWindow, tuesdayWindow, moved], monday), before)
		assert.notEqual(Availability.on([mondayWindow, window('other', monday)], monday), before)
	})
})

describe('converting an entry to availability', () => {
	const day = new DateTime().dayStart

	it('drops participants and reminders but keeps where it is and busy/free', () => {
		const entry = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: day.add({ hours: 9 }), end: day.add({ hours: 10 }),
			location: 'Room 1', transparency: Transparency.Busy, reminders: [10],
			participants: [{ email: 'organizer@example.com', organizer: true }],
		})

		entry.type = EntryType.Availability

		assert.equal(entry.location, 'Room 1')
		assert.equal(entry.transparency, Transparency.Busy)
		assert.equal(entry.reminders, undefined)
		assert.equal(entry.participants, undefined)
		assert.equal(entry.heading, 'Standup')
	})

	it('drops the task fields', () => {
		const entry = new Entry({ sourceId: 's', type: EntryType.Task, status: TaskStatus.Doing, percentComplete: 40 })
		entry.type = EntryType.Availability
		assert.equal(entry.status, undefined)
		assert.equal(entry.percentComplete, undefined)
	})

	it('keeps location and reminders when an event becomes a task', () => {
		const entry = new Entry({ sourceId: 's', type: EntryType.Event, location: 'Room 1', reminders: [10] })
		entry.type = EntryType.Task
		assert.equal(entry.location, 'Room 1')
		assert.deepEqual(entry.reminders, [10])
	})
})

describe('moving availability to a calendar', () => {
	const availability = new Entry({ id: 'a', heading: 'Working hours', type: EntryType.Availability, recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })
	const assess = (capabilities: Integration['capabilities']) =>
		MigrationVerdict.assess(availability, { target: new Source(), capabilities, ownership: new CalDAV().ownership, occurrence: false, occurrences: () => 52 })

	it('is clean where the provider takes part', () => {
		assert.equal(assess(new CalDAV().capabilities).clean, true)
	})

	it('is blocked where it does not, even when flattening would get the series in', () => {
		const verdict = assess(new Notion().capabilities)
		assert.equal(verdict.blockers.includes('availability'), true)
		assert.equal(verdict.moves(true), false)
	})
})

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, MitraCalendar, Source, Entry, EntryRelation, NotificationSubscription, Session],
		dbName: ':memory:',
		subscribers: [children.subscriber],
		forceUndefined: true,
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

const written = new Array<string>()
const recorder: SyncEngine = {
	fetchSources: () => Promise.resolve([]),
	syncSourceEntries: () => Promise.resolve(false),
	createEntry: (_integration, _em, entry) => { written.push(`create ${entry.heading}`); return Promise.resolve(entry) },
	updateEntry: (_integration, _em, existing) => { written.push(`update ${existing.heading}`); return Promise.resolve() },
	deleteEntry: (_integration, _em, entry) => { written.push(`delete ${entry.heading}`); return Promise.resolve() },
	excludeOccurrence: (_integration, _em, master) => { written.push(`exclude ${master.heading}`); return Promise.resolve() },
}
registerEngine('caldav', recorder)

describe('availability in a provider\'s calendar', () => {
	let orm: MikroORM
	let em: EntityManager
	let account: CalDAV
	let work: Source
	let hidden: Source

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	beforeEach(async () => {
		await orm.schema.clear()
		written.length = 0
		em = orm.em.fork()
		const user = new User({ username: 'me' })
		em.persist(user)
		account = new CalDAV({ userId: user.id, uri: 'https://dav.example.com' })
		em.persist(account)
		work = new Source({ integrationId: account.id, uri: 'https://dav.example.com/calendars/me/work/', name: 'Work', enabled: true })
		hidden = new Source({ integrationId: account.id, uri: 'https://dav.example.com/calendars/me/old/', name: 'Old', enabled: false })
		em.persist([work, hidden])
		await em.flush()
	})

	const entry = (init: Partial<Entry>) => new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), sourceId: work.id, ...init })

	it('is stored in Mitra and never written to the provider', async () => {
		const hours = await account.createEntry(em, entry({ type: EntryType.Availability, heading: 'Working hours', recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) }))
		await em.flush()
		await account.updateEntry(em, hours, entry({ type: EntryType.Availability, heading: 'Office hours' }))
		await account.excludeOccurrence(em, hours, new Date('2026-10-05T07:00:00Z'))
		await em.flush()

		assert.equal(hours.heading, 'Office hours')
		assert.equal(hours.exdates?.length, 1)
		await account.deleteEntry(em, hours)
		await em.flush()
		assert.deepEqual(written, [])
		assert.equal(await em.count(Entry, {}), 0)
	})

	it('leaves the provider writing everything else', async () => {
		await account.createEntry(em, entry({ type: EntryType.Event, heading: 'Standup' }))
		assert.deepEqual(written, ['create Standup'])
	})

	it('is out of what syncs read, so a sync or re-import never deletes it', async () => {
		em.persist([entry({ type: EntryType.Availability, heading: 'Working hours' }), entry({ type: EntryType.Event, heading: 'Standup' })])
		await em.flush()

		assert.deepEqual((await account.syncedEntries(em, work)).map(synced => synced.heading), ['Standup'])

		await account.reimportSource(em, work)
		assert.deepEqual((await em.find(Entry, { sourceId: work.id })).map(kept => kept.heading), ['Working hours'])
	})

	it('is handed to the engine as masters and single windows of enabled calendars', async () => {
		const series = entry({ type: EntryType.Availability, heading: 'Working hours', recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })
		em.persist([
			series,
			entry({ type: EntryType.Availability, heading: 'Moved Monday', recurringEntryId: series.id, recurrenceId: new DateTime('2026-10-05T07:00:00Z') }),
			entry({ type: EntryType.Availability, heading: 'Retreat' }),
			entry({ type: EntryType.Availability, heading: 'Old hours', sourceId: hidden.id }),
			entry({ type: EntryType.Event, heading: 'Standup' }),
		])
		await em.flush()

		assert.deepEqual((await account.availability(em)).map(found => found.heading).sort(), ['Retreat', 'Working hours'])
	})
})

describe('availability and relations', () => {
	let orm: MikroORM
	let em: EntityManager
	let user: User
	let calendar: Source

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	beforeEach(async () => {
		await orm.schema.clear()
		em = orm.em.fork()
		user = new User({ username: 'me' })
		em.persist(user)
		const mitra = new MitraCalendar({ userId: user.id })
		calendar = new Source({ integrationId: mitra.id, uri: MitraCalendar.sourceUri('calendar'), name: 'Personal', enabled: true, hidden: false })
		em.persist([mitra, calendar])
		await em.flush()
	})

	const persist = async (init: Partial<Entry>) => {
		const entry = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), heading: 'x', sourceId: calendar.id, ...init })
		em.persist(entry)
		await em.flush()
		return entry
	}

	/** What keeps `entry` from holding a PARENT line to `target`, judged on the graph of the two. */
	const relating = (entry: Entry, target: Entry) =>
		[...EntryRelations.of([{ type: RelationType.Parent, targetUid: target.uid! }]).validate({ entry, graph: RelationGraph.of([entry, target]) })].map(error => error.message)

	it('refuses availability as the source of a relation', async () => {
		const availability = await persist({ type: EntryType.Availability })
		const task = await persist({ type: EntryType.Task })

		assert.match(String(relating(availability, task)), /Availability cannot be related/)
	})

	it('refuses availability as the target of a relation', async () => {
		const availability = await persist({ type: EntryType.Availability })
		const task = await persist({ type: EntryType.Task })

		assert.match(String(relating(task, availability)), /Availability cannot be related/)
	})

	it('allows a relation between two ordinary entries', async () => {
		const parent = await persist({ type: EntryType.Task })
		const child = await persist({ type: EntryType.Task })

		assert.deepEqual(relating(child, parent), [])
	})
})
