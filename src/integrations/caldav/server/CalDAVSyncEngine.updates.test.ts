import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { CalDAV } from '../CalDAV.js'
import '../../server/registerEngines.js'
import { Entry, TaskStatus, Transparency } from '../../../features/entries/Entry.js'
import { EntryType, EntryTypes } from '../../../features/entries/EntryType.js'
import { Recurrence } from '../../../features/recurrence/Recurrence.js'
import { Source } from '../../../features/sources/Source.js'
import { CalDAVAvailability } from './CalDAVAvailability.js'

const COLLECTION = 'https://example.com/cal/'

const calendar = (...lines: Array<string>) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...lines, 'END:VCALENDAR'].join('\r\n')

/** A CalDAV account whose server answers every PUT with `status`, and records what was put. */
function account(status = 204) {
	const puts = new Array<string>()
	const client = {
		updateCalendarObject: ({ calendarObject }: { calendarObject: { data: string } }) => {
			puts.push(calendarObject.data)
			return Promise.resolve({ ok: status < 300, status, statusText: status < 300 ? 'No Content' : 'Internal Server Error', headers: new Headers({ etag: `"etag-${puts.length}"` }), text: () => Promise.resolve('') })
		},
	}
	const integration = new CalDAV({ credentials: { username: 'u', password: 'p' } })
	;(integration as unknown as { client: unknown }).client = Promise.resolve(client)
	return { integration, puts }
}

/** The database's side: the busy events a publish finds, and nothing else. */
const database = (entries: ReadonlyArray<Entry> = []) => ({ find: (entity: unknown) => Promise.resolve(entity === Entry ? [...entries] : []) }) as never

const start = new DateTime('2026-07-06T09:00:00.000Z')

const event = (init?: Partial<Entry>) => new Entry({
	id: crypto.randomUUID(), sourceId: 'work', uri: `${COLLECTION}standup.ics`, uid: 'standup', type: EntryType.Event,
	heading: 'Standup', start, end: start.add({ minutes: 30 }),
	data: { raw: calendar('BEGIN:VEVENT', 'UID:standup', 'SUMMARY:Standup', 'DTSTAMP:20260101T000000Z', 'DTSTART:20260706T090000Z', 'DTEND:20260706T093000Z', 'END:VEVENT'), etag: '"etag-0"' },
	...init,
})

describe('updating a CalDAV entry', () => {
	it('completes a task whose exclusions the database hands back as null, as it does for any empty column', async () => {
		const { integration, puts } = account()
		const task = new Entry({
			id: crypto.randomUUID(), sourceId: 'work', uri: `${COLLECTION}rent.ics`, uid: 'rent', type: EntryType.Task,
			heading: 'Pay the rent', status: TaskStatus.ToDo,
			data: { raw: calendar('BEGIN:VTODO', 'UID:rent', 'SUMMARY:Pay the rent', 'DTSTAMP:20260101T000000Z', 'STATUS:NEEDS-ACTION', 'END:VTODO'), etag: '"etag-0"' },
		})
		task.exdates = null as never
		const done = task.clone()
		done.setStatus(TaskStatus.Done, { percentComplete: true })

		await integration.updateEntry(database(), task, done)

		assert.equal(puts.length, 1)
		assert.match(puts[0]!, /STATUS:COMPLETED/)
		assert.equal(task.status, TaskStatus.Done)
	})

	it('leaves the entry as it was when the server refuses the change, so nothing it never stored is taken for stored', async () => {
		const { integration } = account(500)
		const standup = event()
		const raw = standup.data!.raw
		const renamed = standup.clone()
		renamed.heading = 'Retro'
		renamed.location = 'Room 4'

		await assert.rejects(integration.updateEntry(database(), standup, renamed))

		assert.equal(standup.heading, 'Standup')
		assert.equal(standup.location, '')
		assert.equal(standup.data!.raw, raw)
	})

	it('takes what the server stored, the exclusions included', async () => {
		const { integration, puts } = account()
		const excluded = [Date.parse('2026-07-07T09:00:00.000Z')]
		const series = event({ recurrence: new Recurrence({ freq: 'DAILY' }), exdates: excluded })
		const edited = series.clone()
		edited.heading = 'Daily standup'
		edited.exdates = [...excluded, Date.parse('2026-07-08T09:00:00.000Z')]

		await integration.updateEntry(database(), series, edited)

		assert.equal(puts.length, 1)
		assert.equal(series.heading, 'Daily standup')
		assert.deepEqual(series.exdates, edited.exdates)
		assert.equal(series.data!.etag, '"etag-1"')
	})
})

describe('publishing busy availability to a CalDAV calendar', () => {
	it('writes a change of its exclusions once, not again on every pass after it', async () => {
		const { integration, puts } = account()
		const source = new Source({ id: 'work', integrationId: 'i1', uri: COLLECTION, name: 'Work', entryTypes: EntryTypes.of(EntryType.Event), enabled: true })
		const availability = new Entry({
			id: 'entry-1', uid: 'uid-1', sourceId: 'work', type: EntryType.Availability, heading: 'Deep work', transparency: Transparency.Busy,
			start, end: start.add({ hours: 2 }), recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['MO'] }), exdates: [Date.parse('2026-07-13T09:00:00.000Z')],
		})
		const busy = CalDAVAvailability.eventOf(availability)
		busy.uri = `${COLLECTION}busy.ics`
		busy.data = {
			raw: calendar('BEGIN:VEVENT', `UID:${busy.uid}`, 'SUMMARY:Deep work', 'DTSTAMP:20260101T000000Z', 'DTSTART:20260706T090000Z', 'DTEND:20260706T110000Z', 'RRULE:FREQ=WEEKLY;BYDAY=MO', 'EXDATE:20260713T090000Z', 'TRANSP:OPAQUE', 'END:VEVENT'),
			etag: '"etag-0"',
		}
		availability.exdates = [...availability.exdates!, Date.parse('2026-07-20T09:00:00.000Z')]
		const em = database([busy])

		assert.equal(await CalDAVAvailability.publish(integration, em, [availability], { only: source }), true)
		assert.equal(await CalDAVAvailability.publish(integration, em, [availability], { only: source }), false)
		assert.equal(puts.length, 1)
	})
})
