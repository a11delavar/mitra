import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CountSourceEntries } from './CountSourceEntries.js'

describe('CountSourceEntries', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('counts the entries a calendar holds', async () => {
		assert.equal(await CountSourceEntries.call({ id: server.source.id }), 0)
		await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Standup', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T09:15:00Z') })))
		assert.equal(await CountSourceEntries.call({ id: server.source.id }), 1)
	})
})
