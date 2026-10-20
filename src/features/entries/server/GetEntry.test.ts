import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, settleTimeZone } from '#infrastructure/http/Api.js'
import { OperationServer, type SentEntry as Row } from '#infrastructure/operations/OperationServer.testing.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'

describe('GetEntry', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers one entry as stored', async () => {
		const created = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Dentist', location: 'Main Street 1', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T10:00:00Z') }))
		const answer = await fetch(`${server.url}/entries/${created.id}`)
		assert.equal(answer.status, 200)
		assert.deepEqual(await answer.json().then(entry => [(entry as Entry).id, (entry as Entry).location]), [created.id, 'Main Street 1'])
	})

	it('refuses an entry the user does not hold', async () => {
		assert.equal((await fetch(`${server.url}/entries/${crypto.randomUUID()}`)).status, 404)
	})

	describe('as a tool', () => {
		before(() => settleTimeZone('Europe/Berlin'))

		it('reads an entry whole, a repeating one with its rule', async () => {
			const parcel = await server.tool<Row>('create_entry', { heading: 'Pick up parcel', type: 'task', due: '2027-03-05T18:00[Europe/Berlin]', description: 'At the corner shop', location: 'Main Street 1' })
			const read = await server.tool<Row>('get_entry', { id: parcel.id })
			assert.deepEqual([read.description, read.location, read.due], ['At the corner shop', 'Main Street 1', '2027-03-05T17:00:00.000Z'])

			const standup = await server.tool<Row>('create_entry', { heading: 'Standup', start: '2026-01-05T09:00[Europe/Berlin]', end: '2026-01-05T09:15[Europe/Berlin]', recurrence: 'FREQ=DAILY' })
			const { recurrence } = await server.tool<Row>('get_entry', { id: standup.id })
			assert.equal(recurrence, 'FREQ=DAILY')
		})

		it('answers an entry the user does not hold as a refusal the agent reads', async () => {
			const answer = await server.callTool('get_entry', { id: crypto.randomUUID() })
			assert.equal(answer.isError, true)
			assert.match(answer.content[0]!.text, /Nothing with that id/)
		})
	})
})
