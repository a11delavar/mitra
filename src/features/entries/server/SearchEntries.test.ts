import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, createSource, searchEntries, toggleSourceVisibility } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'

describe('SearchEntries', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('finds entries in hidden calendars too', async () => {
		const archive = await createSource(server.integration.id, { name: 'Archive' })
		await toggleSourceVisibility(archive.id, true)
		const start = new DateTime(Date.parse('2026-06-03T09:00:00+02:00'))
		const archived = await createEvent(new Entry({ sourceId: archive.id, type: EntryType.Event, heading: 'Archived review', start, end: start.add({ hours: 1 }) }))
		assert.deepEqual((await searchEntries('Archived')).map(entry => entry.id), [archived.id])
	})

	it('finds nothing for no words', async () => {
		assert.deepEqual(await searchEntries(' '), [])
	})
})
