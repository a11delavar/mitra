import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType } from '#features/entries'
import { createEvent, searchLocations } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('SuggestLocations', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	// A single letter asks no geocoder, so the suggestions are the user's own recent locations alone.
	it('suggests the user\'s recent locations', async () => {
		await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Dentist', location: 'Main Street 1', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T10:00:00Z') }))
		assert.deepEqual((await searchLocations('M')).map(suggestion => suggestion.location), ['Main Street 1'])
	})
})
