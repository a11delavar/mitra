import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Recurrence, RecurrenceFrequency } from '#features/recurrence'
import { createEvent, settleTimeZone } from '#infrastructure/http/Api.js'
import { OperationServer, type SentEntry as Row } from '#infrastructure/operations/OperationServer.testing.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'

describe('CompleteTask', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	/** As a notification's Done button sends it: the occurrence as its start in milliseconds. */
	const complete = (id: string, body: object = {}) => fetch(`${server.url}/entries/${id}/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
	const timed = (heading: string, init: Partial<Entry> = {}) => new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T10:00:00Z'), ...init })
	const status = async (id: string) => (await server.query<{ status: string | null }>('select status from entry where id = ?', [id]))[0]?.status

	it('marks a task done, and a second tap writes nothing more', async () => {
		const task = await createEvent(timed('Send the invoice', { type: EntryType.Task }))
		assert.equal((await complete(task.id!)).status, 200)
		assert.equal(await status(task.id!), 'done')
		assert.equal((await complete(task.id!)).status, 200)
		assert.equal(await status(task.id!), 'done')
	})

	it('marks one occurrence of a repeating task done alone, the rest still to come', async () => {
		const series = await createEvent(timed('Water the plants', { type: EntryType.Task, recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily, count: 3 }) }))
		const answer = await complete(series.id!, { occurrence: '2026-07-02T09:00:00Z' })
		assert.equal(answer.status, 200)
		const detached = await answer.json() as { id: string }
		assert.notEqual(detached.id, series.id)
		assert.equal(await status(detached.id), 'done')
		assert.notEqual(await status(series.id!), 'done')
	})

	it('refuses an event, which has nothing to complete', async () => {
		const event = await createEvent(timed('Lunch'))
		const answer = await complete(event.id!)
		assert.equal(answer.status, 400)
		assert.deepEqual(await answer.json(), { error: 'Only a task can be completed' })
	})

	it('refuses a repeating task without its occurrence, which would close it for good', async () => {
		const series = await createEvent(timed('Stretch', { type: EntryType.Task, recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily, count: 3 }) }))
		const answer = await complete(series.id!)
		assert.equal(answer.status, 400)
		assert.notEqual(await status(series.id!), 'done')
	})

	describe('as a tool', () => {
		before(() => settleTimeZone('Europe/Berlin'))

		it('completes a task, and one occurrence of a repeating task alone, which it names', async () => {
			const task = await server.tool<Row>('create_entry', { heading: 'Renew the passport', type: 'task' })
			assert.equal((await server.tool<Row>('complete_task', { id: task.id })).status, 'done')

			const series = await server.tool<Row>('create_entry', { heading: 'Water plants', type: 'task', start: '2027-03-01T08:00[Europe/Berlin]', recurrence: 'FREQ=WEEKLY;BYDAY=MO' })
			assert.match((await server.callTool('complete_task', { id: series.id })).content[0]!.text, /name the occurrence/)
			const done = await server.tool<Row>('complete_task', { id: series.id, occurrence: '2027-03-08T07:00:00Z' })
			assert.notEqual(done.id, series.id)
			assert.equal(done.status, 'done')
		})
	})
})
