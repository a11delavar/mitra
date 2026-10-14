import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import express from 'express'
import { Api } from '@a11d/api'
import { DateTime } from '@3mo/date-time'
import '@3mo/date-time-value-constructor'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { createEvent, deleteOccurrence, editOccurrence, fetchEvents, updateEvent } from '../../../infrastructure/http/Api.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { EntryTimeZone } from '../EntryTimeZone.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../../recurrence/RecurrenceFrequency.js'
import { User } from '../../identity/User.js'
import { Source } from '../../sources/Source.js'
import { MitraCalendar } from '../../../integrations/mitra/MitraCalendar.js'
import { midnightOf } from '../../time/calendarDate.js'

/*
	All-day and timed entries between viewers in different zones, through the app's own API client, the real entry routes
	and a database: what each viewer sees and what is stored, whichever way the dates cross the wire. A viewer is this
	process's zone (`process.env.TZ`), which the browser's Intl and Date both follow.

	The routes open the app's database module, so they are imported after its folder exists: under out_test, which every
	run rebuilds, never the developer's data/.
*/

const zones = { berlin: 'Europe/Berlin', newYork: 'America/New_York', tehran: 'Asia/Tehran', auckland: 'Pacific/Auckland' }

/** Makes this process a viewer in `zone`, reading days there as a browser does. */
const viewIn = (zone: string) => {
	process.env.TZ = zone
	Entry.dayZone = () => zone
}

/** The midnight that begins `day` where this process is. */
const midnight = (day: string) => new DateTime(midnightOf(Temporal.PlainDate.from(day), process.env.TZ!).getTime())
const utcMidnight = (day: string) => Date.UTC(...day.split('-').map(Number).map((part, index) => index === 1 ? part - 1 : part) as [number, number, number])
const iso = (value: { valueOf(): number } | null | undefined) => value === null || value === undefined ? value : new Date(value.valueOf()).toISOString()

describe('Entries over the wire, between viewers in different zones', () => {
	let server: Server
	let source: Source
	let stored: (id: string) => Promise<{ start: number | null, end: number | null, due: number | null, exdates: string | null }>
	let named: (heading: string) => Promise<Array<{ start: number, end: number, recurrence_master_id: string | null }>>
	let closeOrm: () => Promise<void>

	before(async () => {
		mkdirSync(`${import.meta.dirname}/../../data`, { recursive: true })
		const { orm } = await import('../../../infrastructure/database/orm.js')
		await import('../../../integrations/server/registerEngines.js')
		const { entriesRouter } = await import('./entries.js')

		const em = orm.em.fork()
		const user = new User({ username: 'viewer' })
		const integration = new MitraCalendar({ userId: user.id, uri: MitraCalendar.uri })
		source = new Source({ integrationId: integration.id, uri: MitraCalendar.sourceUri('home'), name: 'Home', entryTypes: [EntryType.Event, EntryType.Task], enabled: true, hidden: false })
		em.persist([user, integration, source])
		await em.flush()

		const connection = orm.em.getConnection()
		stored = async id => (await connection.execute('select start, end, due, exdates from entry where id = ?', [id]))[0] as never
		named = heading => connection.execute('select start, end, recurrence_master_id from entry where heading = ?', [heading])
		closeOrm = () => orm.close()

		const models = new ModelValueConstructor()
		const app = express()
		app.use((req, res, next) => {
			req.user = user
			// From parsing the body on, this is the server, which keeps days as stored; the viewer is back once the response is out.
			const viewer = Entry.dayZone
			Entry.dayZone = () => undefined
			const end = res.end.bind(res) as (...parameters: Array<unknown>) => typeof res
			res.end = ((...parameters: Array<unknown>) => {
				Entry.dayZone = viewer
				return end(...parameters)
			}) as typeof res.end
			next()
		})
		app.use(express.json({ reviver: (_key, value) => models.shallConstruct(value) ? models.construct(value) : value }))
		app.use('/api/entries', entriesRouter)
		server = await new Promise<Server>(resolve => {
			const listening = app.listen(0, () => resolve(listening))
		})
		Api.url = `http://localhost:${(server.address() as AddressInfo).port}/api`
		// @a11d/api sets `referrer: 'no-referrer'`, which a browser resolves against the page and Node's fetch refuses.
		const browserFetch = globalThis.fetch
		globalThis.fetch = (input, init) => browserFetch(input, { ...init, referrer: undefined })
	})

	after(async () => {
		await new Promise(resolve => server.close(resolve))
		await closeOrm()
	})

	const window = (from: string, to: string) => fetchEvents(midnight(from), midnight(to))
	const allDay = (heading: string, start: string, end: string, init: Partial<Entry> = {}) =>
		new Entry({ sourceId: source.id, type: EntryType.Event, heading, allDay: true, start: midnight(start), end: midnight(end), ...init })

	describe('an all-day entry', () => {
		let id: string

		it('is stored as the UTC midnights of the days its author saw', async () => {
			viewIn(zones.berlin)
			const created = await createEvent(allDay('Holiday', '2026-06-02', '2026-06-05'))
			id = created.id!
			assert.deepEqual([iso(created.start), iso(created.end)], [iso(midnight('2026-06-02')), iso(midnight('2026-06-05'))])
			const row = await stored(id)
			assert.deepEqual([row.start, row.end], [utcMidnight('2026-06-02'), utcMidnight('2026-06-05')])
		})

		it('reaches every viewer on the same days, at their own midnights', async () => {
			for (const zone of Object.values(zones)) {
				viewIn(zone)
				const holiday = (await window('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
				assert.equal(holiday.start instanceof DateTime, true, zone)
				assert.deepEqual([iso(holiday.start), iso(holiday.end)], [iso(midnight('2026-06-02')), iso(midnight('2026-06-05'))], zone)
			}
		})

		it('keeps its days through an edit elsewhere, and moves by a whole day where its viewer moves it', async () => {
			viewIn(zones.newYork)
			const holiday = (await window('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
			holiday.heading = 'Long weekend'
			await updateEvent(holiday)
			assert.deepEqual(Object.values(await stored(id)).slice(0, 2), [utcMidnight('2026-06-02'), utcMidnight('2026-06-05')])

			holiday.start = midnight('2026-06-03')
			const moved = await updateEvent(holiday)
			assert.equal(iso(moved.start), iso(midnight('2026-06-03')))
			assert.deepEqual(Object.values(await stored(id)).slice(0, 2), [utcMidnight('2026-06-03'), utcMidnight('2026-06-05')])

			viewIn(zones.auckland)
			const seen = (await window('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
			assert.deepEqual([seen.heading, iso(seen.start), iso(seen.end)], ['Long weekend', iso(midnight('2026-06-03')), iso(midnight('2026-06-05'))])
		})
	})

	describe('an all-day series', () => {
		let masterId: string

		it('shows each viewer its occurrences on the same days', async () => {
			viewIn(zones.tehran)
			const master = await createEvent(allDay('Market', '2026-07-06', '2026-07-07', { recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) }))
			masterId = master.id!
			for (const zone of Object.values(zones)) {
				viewIn(zone)
				const occurrences = (await window('2026-07-01', '2026-07-25')).filter(entry => entry.recurringEntryId === masterId)
				assert.deepEqual(occurrences.map(occurrence => iso(occurrence.start)), ['2026-07-06', '2026-07-13', '2026-07-20'].map(day => iso(midnight(day))), zone)
				assert.deepEqual(occurrences.map(occurrence => iso(occurrence.recurrenceId)), ['2026-07-06', '2026-07-13', '2026-07-20'].map(day => iso(midnight(day))), zone)
				assert.deepEqual(occurrences.map(occurrence => occurrence.id), ['2026-07-06', '2026-07-13', '2026-07-20'].map(day => `${masterId}__${utcMidnight(day)}`), zone)
			}
		})

		it('detaches and deletes the occurrence its viewer points at, by the day it falls on', async () => {
			viewIn(zones.newYork)
			const [, second, third] = (await window('2026-07-01', '2026-07-25')).filter(entry => entry.recurringEntryId === masterId)
			second!.heading = 'Night market'
			await editOccurrence(second!, 'this')
			await deleteOccurrence(third!, 'this')
			// Editing one occurrence makes it an entry of its own on that day, which the series then skips.
			assert.deepEqual((await named('Night market')).map(row => [row.start, row.end, row.recurrence_master_id]), [[utcMidnight('2026-07-13'), utcMidnight('2026-07-14'), null]])
			assert.deepEqual(JSON.parse((await stored(masterId)).exdates ?? '[]'), [utcMidnight('2026-07-13'), utcMidnight('2026-07-20')])

			viewIn(zones.auckland)
			const seen = (await window('2026-07-01', '2026-07-25')).filter(entry => entry.recurringEntryId === masterId || entry.heading === 'Night market')
			assert.deepEqual(seen.map(entry => [entry.heading, iso(entry.start)]).sort(), [['Market', iso(midnight('2026-07-06'))], ['Night market', iso(midnight('2026-07-13'))]])
		})
	})

	describe('a timed entry', () => {
		it('is the same instant for every viewer, in the zone it was written in', async () => {
			viewIn(zones.berlin)
			const start = new DateTime(Date.parse('2026-06-02T09:30:00+02:00'))
			const created = await createEvent(new Entry({ sourceId: source.id, type: EntryType.Event, heading: 'Call', start, end: start.add({ minutes: 30 }) }))
			assert.equal(created.timeZone?.id, 'Europe/Berlin')
			assert.deepEqual(Object.values(await stored(created.id!)).slice(0, 2), [Date.parse('2026-06-02T07:30:00Z'), Date.parse('2026-06-02T08:00:00Z')])
			for (const zone of Object.values(zones)) {
				viewIn(zone)
				const call = (await window('2026-05-25', '2026-06-15')).find(entry => entry.id === created.id)!
				assert.deepEqual([iso(call.start), iso(call.end), call.timeZone], ['2026-06-02T07:30:00.000Z', '2026-06-02T08:00:00.000Z', EntryTimeZone.parse('Europe/Berlin')], zone)
			}
		})
	})

	describe('a tab from before days traveled as days', () => {
		it('is refused a write, which would store its own midnights, and asked to reload', async () => {
			const write = await fetch(`${Api.url}/entries/${crypto.randomUUID()}?tz=Europe%2FBerlin`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' })
			assert.equal(write.status, 409)
			const read = await fetch(`${Api.url}/entries/search?q=Holiday&tz=Europe%2FBerlin`)
			assert.equal(read.status, 200)
		})
	})
})
