import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, createSource, fetchAllEntries, toggleSourceVisibility } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../../recurrence/RecurrenceFrequency.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'

describe('ListAllEntries', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const timed = (sourceId: string, heading: string, start: string, init: Partial<Entry> = {}) =>
		new Entry({ sourceId, type: EntryType.Event, heading, start: new DateTime(start), end: new DateTime(start).add({ hours: 1 }), ...init })

	it('lists every entry of the visible calendars, each recurring entry once', async () => {
		const archive = await createSource(server.integration.id, { name: 'Archive' })
		await toggleSourceVisibility(archive.id, true)
		await createEvent(timed(server.source.id, 'Long ago', '2019-03-01T09:00:00Z'))
		await createEvent(timed(server.source.id, 'Daily', '2026-07-01T08:00:00Z', { recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) }))
		await createEvent(timed(archive.id, 'Hidden', '2026-07-01T09:00:00Z'))
		assert.deepEqual((await fetchAllEntries()).map(entry => entry.heading).sort(), ['Daily', 'Long ago'])
	})
})
