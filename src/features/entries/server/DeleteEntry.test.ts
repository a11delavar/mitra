import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, deleteEvent, deleteOccurrence } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../../recurrence/RecurrenceFrequency.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { iso, midnight, shown, utcMidnight, viewIn, zones } from './viewers.testing.js'

describe('DeleteEntry', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const stored = async (id: string) => (await server.query<{ exdates: string | null }>('select exdates from entry where id = ?', [id]))[0]

	it('deletes an entry whole, and a second delete finds nothing', async () => {
		viewIn(zones.berlin)
		const errand = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Task, heading: 'Cancelled errand', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T10:00:00Z') }))
		await deleteEvent(errand.id!)
		assert.equal(await stored(errand.id!), undefined)
		await assert.rejects(deleteEvent(errand.id!))
	})

	it('deletes the occurrence of an all-day series its viewer points at, by the day it falls on', async () => {
		viewIn(zones.tehran)
		const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Market', allDay: true, start: midnight('2026-07-06'), end: midnight('2026-07-07'), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) }))

		viewIn(zones.newYork)
		const [, , third] = (await shown('2026-07-01', '2026-07-25')).filter(occurrence => occurrence.recurringEntryId === id)
		await deleteOccurrence(third!, 'this')
		assert.deepEqual(JSON.parse((await stored(id!))!.exdates ?? '[]'), [utcMidnight('2026-07-20')])

		viewIn(zones.auckland)
		const seen = (await shown('2026-07-01', '2026-07-25')).filter(occurrence => occurrence.recurringEntryId === id)
		assert.deepEqual(seen.map(occurrence => iso(occurrence.start)), [iso(midnight('2026-07-06')), iso(midnight('2026-07-13'))])
	})
})
