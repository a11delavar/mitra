import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, createSource, settleTimeZone, updateEvent } from '#infrastructure/http/Api.js'
import { OperationServer, type SentEntry as Row } from '#infrastructure/operations/OperationServer.testing.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { fetched, iso, midnight, utcMidnight, viewIn, zones } from './viewers.testing.js'

describe('UpdateEntry', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const stored = async (id: string) => (await server.query<{ start: number | null, end: number | null }>('select start, end from entry where id = ?', [id]))[0]
	const timed = (heading: string) => new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T10:00:00Z') })

	describe('an all-day entry', () => {
		it('keeps its days through an edit elsewhere, and moves by a whole day where its viewer moves it', async () => {
			viewIn(zones.berlin)
			const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Holiday', allDay: true, start: midnight('2026-06-02'), end: midnight('2026-06-05') }))

			viewIn(zones.newYork)
			const holiday = (await fetched('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
			holiday.heading = 'Long weekend'
			await updateEvent(holiday)
			assert.deepEqual(Object.values((await stored(id!))!), [utcMidnight('2026-06-02'), utcMidnight('2026-06-05')])

			holiday.start = midnight('2026-06-03')
			const moved = await updateEvent(holiday)
			assert.equal(iso(moved.start), iso(midnight('2026-06-03')))
			assert.deepEqual(Object.values((await stored(id!))!), [utcMidnight('2026-06-03'), utcMidnight('2026-06-05')])

			viewIn(zones.auckland)
			const seen = (await fetched('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
			assert.deepEqual([seen.heading, iso(seen.start), iso(seen.end)], ['Long weekend', iso(midnight('2026-06-03')), iso(midnight('2026-06-05'))])
		})
	})

	describe('an entry moved or converted', () => {
		it('is created in the other calendar under a new id, keeping its uid, and leaves the first', async () => {
			viewIn(zones.berlin)
			const work = await createSource(server.integration.id, { name: 'Work' })
			const created = await createEvent(timed('Review'))
			created.sourceId = work.id
			const moved = await updateEvent(created)
			assert.notEqual(moved.id, created.id)
			assert.equal(moved.sourceId, work.id)
			assert.equal(moved.uid, created.uid)
			assert.equal(await stored(created.id!), undefined)
			assert.deepEqual(Object.values((await stored(moved.id!))!), [Date.parse('2026-07-01T09:00:00Z'), Date.parse('2026-07-01T10:00:00Z')])
		})

		it('becomes a task under a new id in the same calendar', async () => {
			viewIn(zones.berlin)
			const created = await createEvent(timed('Write up'))
			created.type = EntryType.Task
			const converted = await updateEvent(created)
			assert.notEqual(converted.id, created.id)
			assert.equal(converted.type, EntryType.Task)
			assert.equal(await stored(created.id!), undefined)
		})
	})

	describe('as a tool', () => {
		before(() => settleTimeZone('Europe/Berlin'))

		it('changes an entry, its times read in the home zone', async () => {
			const created = await server.tool<Row>('create_entry', { heading: 'Draft review', start: '2027-03-03T14:00[Europe/Berlin]', end: '2027-03-03T15:00[Europe/Berlin]' })
			const renamed = await server.tool<Row>('update_entry', { id: created.id, heading: 'Design review', end: '2027-03-03T15:30[Europe/Berlin]' })
			assert.deepEqual([renamed.id, renamed.heading, renamed.end], [created.id, 'Design review', '2027-03-03T14:30:00.000Z'])
		})

		it('moves an entry to another calendar, naming the entry\'s new id', async () => {
			const projects = await createSource(server.integration.id, { name: 'Projects' })
			const created = await server.tool<Row>('create_entry', { heading: 'Kickoff', start: '2027-03-04T10:00[Europe/Berlin]', end: '2027-03-04T11:00[Europe/Berlin]' })
			const moved = await server.tool<Row>('update_entry', { id: created.id, sourceId: projects.id })
			assert.notEqual(moved.id, created.id)
			assert.deepEqual([moved.sourceId, moved.heading, moved.start], [projects.id, 'Kickoff', '2027-03-04T09:00:00.000Z'])
			assert.equal((await server.callTool('get_entry', { id: created.id })).isError, true)
		})
	})
})
