import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { CreateSource } from '#features/sources/server/CreateSource.js'
import { CountSourceEntries } from '#features/sources/server/CountSourceEntries.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { PreviewSourceMigration } from './PreviewSourceMigration.js'

describe('PreviewSourceMigration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('previews a move without moving anything', async () => {
		const work = await CreateSource.call({ id: server.integration.id, name: 'Work' })
		await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Standup', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T09:15:00Z') })))
		const plan = await PreviewSourceMigration.call({ id: server.source.id, targetSourceId: work.id, keepOriginals: false })
		assert.ok(plan)
		assert.equal(await CountSourceEntries.call({ id: server.source.id }), 1)
		assert.equal(await CountSourceEntries.call({ id: work.id }), 0)
	})

	it('refuses a move into the calendar it comes from', async () => {
		await assert.rejects(PreviewSourceMigration.call({ id: server.source.id, targetSourceId: server.source.id, keepOriginals: false }))
	})
})
