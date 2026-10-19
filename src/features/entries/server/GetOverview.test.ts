import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createSource, settleTimeZone, toggleSourceVisibility } from '../../../infrastructure/http/Api.js'
import { OperationServer, type SentEntry as Row } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('GetOverview', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	describe('as a tool', () => {
		before(() => settleTimeZone('Europe/Berlin'))

		const listed = (from: string, to: string) => server.tool<{ entries: Array<Row>, availability: Array<Row>, overdue: Array<Row>, unscheduled: Array<Row> }>('get_overview', { start: from, end: to })

		it('lists an entry of the day in the home zone', async () => {
			await server.tool('create_entry', { heading: 'Dentist', start: '2027-04-06T09:00[Europe/Berlin]', end: '2027-04-06T10:00[Europe/Berlin]' })
			assert.deepEqual((await listed('2027-04-06', '2027-04-06')).entries.map(row => [row.heading, row.start, row.end]), [['Dentist', '2027-04-06T07:00:00.000Z', '2027-04-06T08:00:00.000Z']])
		})

		it('lists an all-day entry through its last day, and not the day after', async () => {
			await server.tool('create_entry', { heading: 'Conference', start: '2027-04-13', end: '2027-04-15', allDay: true })
			assert.deepEqual((await listed('2027-04-14', '2027-04-14')).entries.map(row => row.heading), ['Conference'])
			assert.deepEqual((await listed('2027-04-15', '2027-04-15')).entries, [])
		})

		it('lists a repeating task once per occurrence, each with its own id', async () => {
			const { id } = await server.tool<Row>('create_entry', { heading: 'Water plants', type: 'task', start: '2027-05-03T08:00[Europe/Berlin]', estimate: 15, recurrence: 'FREQ=WEEKLY;BYDAY=MO' })
			const rows = (await listed('2027-05-03', '2027-05-16')).entries.filter(row => row.id === id)
			assert.deepEqual(rows.map(row => [row.occurrence, row.start]), [['2027-05-03T06:00:00.000Z', '2027-05-03T06:00:00.000Z'], ['2027-05-10T06:00:00.000Z', '2027-05-10T06:00:00.000Z']])
		})

		it('names the tasks left open before the window and the unscheduled ones apart from it', async () => {
			await server.tool('create_entry', { heading: 'File the tax return', type: 'task', start: '2027-01-04T09:00[Europe/Berlin]', end: '2027-01-04T10:00[Europe/Berlin]' })
			await server.tool('create_entry', { heading: 'Sort the photos', type: 'task' })
			const day = await listed('2027-06-01', '2027-06-01')
			assert.deepEqual([day.entries.length, day.overdue.map(row => row.heading), day.unscheduled.map(row => row.heading)], [0, ['File the tax return'], ['Sort the photos']])
		})

		it('reads every calendar, those hidden in the app included', async () => {
			const hidden = await createSource(server.integration.id, { name: 'Hobbies' })
			await toggleSourceVisibility(hidden.id, true)
			await server.tool('create_entry', { heading: 'Volleyball', sourceId: hidden.id, start: '2027-08-02T19:00[Europe/Berlin]', end: '2027-08-02T21:00[Europe/Berlin]' })
			assert.ok((await listed('2027-08-02', '2027-08-02')).entries.some(row => row.heading === 'Volleyball'))
		})

		it('names the availability written like any entry apart from the entries', async () => {
			await server.tool('create_entry', { heading: 'Office hours', type: 'availability', start: '2027-07-05T09:00[Europe/Berlin]', end: '2027-07-05T17:00[Europe/Berlin]', recurrence: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' })
			const day = await listed('2027-07-06', '2027-07-06')
			assert.deepEqual([day.entries.length, day.availability.map(row => [row.heading, row.start])], [0, [['Office hours', '2027-07-06T07:00:00.000Z']]])
		})
	})
})
