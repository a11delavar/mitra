import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
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
		const created = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Holiday', allDay: true, start: midnight('2026-06-02'), end: midnight('2026-06-05') }))
		assert.deepEqual([iso(created.start), iso(created.end)], [iso(midnight('2026-06-02')), iso(midnight('2026-06-05'))])
		const row = await stored(created.id!)
		assert.deepEqual([row.start, row.end], [utcMidnight('2026-06-02'), utcMidnight('2026-06-05')])
	})

	it('stores a timed entry at its instants, in the zone its author wrote it in', async () => {
		viewIn(zones.berlin)
		const start = new DateTime(Date.parse('2026-06-02T09:30:00+02:00'))
		const created = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Call', start, end: start.add({ minutes: 30 }) }))
		assert.equal(created.timeZone?.id, 'Europe/Berlin')
		const row = await stored(created.id!)
		assert.deepEqual([row.start, row.end], [Date.parse('2026-06-02T07:30:00Z'), Date.parse('2026-06-02T08:00:00Z')])
	})
})
