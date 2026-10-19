import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, deleteEvent, settleTimeZone } from '../../../infrastructure/http/Api.js'
import { OperationServer, type SentEntry as Row } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { viewIn, zones } from './viewers.testing.js'

describe('DeleteEntry', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const stored = async (id: string) => (await server.query<{ id: string }>('select id from entry where id = ?', [id]))[0]

	it('deletes an entry whole, and a second delete finds nothing', async () => {
		viewIn(zones.berlin)
		const errand = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Task, heading: 'Cancelled errand', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T10:00:00Z') }))
		await deleteEvent(errand.id!)
		assert.equal(await stored(errand.id!), undefined)
		await assert.rejects(deleteEvent(errand.id!))
	})

	describe('as a tool', () => {
		before(() => settleTimeZone('Europe/Berlin'))

		it('deletes a repeating entry with every occurrence', async () => {
			const series = await server.tool<Row>('create_entry', { heading: 'Standup', start: '2027-03-01T09:00[Europe/Berlin]', end: '2027-03-01T09:15[Europe/Berlin]', recurrence: 'FREQ=DAILY' })
			await server.tool('delete_entry', { id: series.id })
			assert.equal(await stored(series.id), undefined)
			assert.equal((await server.callTool('get_entry', { id: series.id })).isError, true)
		})
	})
})
