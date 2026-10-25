import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { TimeZone } from '#features/time/TimeZone.js'
import { SettleHomeTimeZone } from '#features/time/server/SettleHomeTimeZone.js'
import { OperationServer, type SentEntry as Row } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateEntry } from './CreateEntry.js'
import { EntryPatch } from '../EntryPatch.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { iso, midnight, utcMidnight, viewIn, zones } from './viewers.testing.js'

describe('CreateEntry', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const stored = async (id: string) => (await server.query<{ start: number, end: number }>('select start, end from entry where id = ?', [id]))[0]!

	it('stores an all-day entry as the UTC midnights of the days its author saw', async () => {
		viewIn(zones.berlin)
		const created = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Holiday', allDay: true, start: midnight('2026-06-02'), end: midnight('2026-06-05') })))
		assert.deepEqual([iso(created.start), iso(created.end)], [iso(midnight('2026-06-02')), iso(midnight('2026-06-05'))])
		const row = await stored(created.id!)
		assert.deepEqual([row.start, row.end], [utcMidnight('2026-06-02'), utcMidnight('2026-06-05')])
	})

	it('stores a timed entry at its instants, in the zone its author wrote it in', async () => {
		viewIn(zones.berlin)
		const start = new DateTime(Date.parse('2026-06-02T09:30:00+02:00'))
		const created = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Call', start, end: start.add({ minutes: 30 }) })))
		assert.equal(created.timeZone?.id, 'Europe/Berlin')
		const row = await stored(created.id!)
		assert.deepEqual([row.start, row.end], [Date.parse('2026-06-02T07:30:00Z'), Date.parse('2026-06-02T08:00:00Z')])
	})

	describe('as a tool', () => {
		before(() => SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') }))

		it('creates an event at a wall-clock time in the home zone, in the calendar new entries go to', async () => {
			const created = await server.tool<Row>('create_entry', { heading: 'Dentist', start: '2027-03-02T09:00[Europe/Berlin]', end: '2027-03-02T10:00[Europe/Berlin]' })
			assert.deepEqual([created.sourceId, created.start, created.end], [server.source.id, '2027-03-02T08:00:00.000Z', '2027-03-02T09:00:00.000Z'])
		})

		it('reads a time in the zone written with it, and refuses a zone that does not exist', async () => {
			const created = await server.tool<Row>('create_entry', { heading: 'Call with the Tokyo office', start: '2027-03-02T17:00[Asia/Tokyo]', end: '2027-03-02T17:30[Asia/Tokyo]', timeZone: 'Asia/Tokyo' })
			assert.deepEqual([created.start, created.end], ['2027-03-02T08:00:00.000Z', '2027-03-02T08:30:00.000Z'])
			assert.match((await server.callTool('create_entry', { heading: 'Call', start: '2027-03-02T17:00[Mars/Olympus]' })).content[0]!.text, /names no time zone/)
			assert.match((await server.callTool('create_entry', { heading: 'Call', start: '2027-03-02T17:00[Europe/Berlin]', timeZone: 'Mars/Olympus' })).content[0]!.text, /not a time zone/)
		})

		it('ends an all-day entry on the day after its last', async () => {
			const created = await server.tool<Row>('create_entry', { heading: 'Conference', start: '2027-03-10', end: '2027-03-12', allDay: true })
			assert.deepEqual([created.start, created.end, created.allDay], ['2027-03-10T00:00:00.000Z', '2027-03-12T00:00:00.000Z', true])
			assert.deepEqual(Object.values((await stored(created.id))), [utcMidnight('2027-03-10'), utcMidnight('2027-03-12')])
		})

		it('makes a task due on a day, and one due at a time', async () => {
			const due = await server.tool<Row>('create_entry', { heading: 'Book flights', type: 'task', due: '2027-03-05', allDay: true })
			assert.deepEqual([due.allDay, due.due], [true, '2027-03-05T00:00:00.000Z'])
			const timed = await server.tool<Row>('create_entry', { heading: 'Prepare slides', type: 'task', start: '2027-03-04T09:00[Europe/Berlin]', end: '2027-03-04T10:00[Europe/Berlin]', due: '2027-03-06T00:00[Europe/Berlin]' })
			assert.deepEqual([timed.allDay, timed.due], [false, '2027-03-05T23:00:00.000Z'])
		})

		it('refuses what is not a date, an end before its start, and a calendar that does not exist', async () => {
			assert.match((await server.callTool('create_entry', { heading: 'Lunch', start: 'next tuesday' })).content[0]!.text, /start/)
			assert.match((await server.callTool('create_entry', { heading: 'Lunch', start: '2027-03-04T13:00[Europe/Berlin]', end: '2027-03-04T12:00[Europe/Berlin]' })).content[0]!.text, /end: An entry cannot end before it starts/)
			assert.match((await server.callTool('create_entry', { heading: 'Lunch', start: '2027-03-04T12:00[Europe/Berlin]', sourceId: 'Holidays' })).content[0]!.text, /Nothing with that id exists/)
		})

		it('refuses a day without allDay, which would be a UTC midnight', async () => {
			assert.match((await server.callTool('create_entry', { heading: 'Send the postcards', type: 'task', due: '2027-03-05' })).content[0]!.text, /^due: "2027-03-05" is a day: send allDay: true/)
		})

		it('writes the people taking part, the user leading as organizer', async () => {
			const created = await server.tool<Row & { participants: Array<{ email: string, organizer?: boolean, role: string }> }>('create_entry', {
				heading: 'Team meeting', start: '2027-03-08T10:00[Europe/Berlin]', end: '2027-03-08T11:00[Europe/Berlin]',
				participants: [{ email: 'organizer@example.com', organizer: true, self: true }, { email: 'colleague@example.com', role: 'optional' }],
			})
			assert.deepEqual(created.participants.map(participant => [participant.email, !!participant.organizer, participant.role]), [['organizer@example.com', true, 'required'], ['colleague@example.com', false, 'optional']])
			assert.equal((await server.callTool('create_entry', { heading: 'Lunch', start: '2027-03-08T12:00[Europe/Berlin]', participants: [{ email: 'not an address' }] })).isError, true)
		})
	})
})
