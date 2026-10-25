import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { LocationSuggestion } from '../LocationSuggestion.js'
import { SuggestLocations } from './SuggestLocations.js'

describe('SuggestLocations', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	// A single letter asks no geocoder, so the suggestions are the user's own recent locations alone.
	it('suggests the user\'s recent locations', async () => {
		await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Dentist', location: 'Main Street 1', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T10:00:00Z') })))
		assert.deepEqual((await SuggestLocations.call({ q: 'M' })).map(place => new LocationSuggestion(place).location), ['Main Street 1'])
	})
})
