import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { countSourceEntries, createEvent, createSource, previewSourceMigration } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Entry } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'

describe('PreviewSourceMigration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('previews a move without moving anything', async () => {
		const work = await createSource(server.integration.id, { name: 'Work' })
		await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Standup', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T09:15:00Z') }))
		const plan = await previewSourceMigration(server.source.id, work.id, false)
		assert.ok(plan)
		assert.equal(await countSourceEntries(server.source.id), 1)
		assert.equal(await countSourceEntries(work.id), 0)
	})

	it('refuses a move into the calendar it comes from', async () => {
		await assert.rejects(previewSourceMigration(server.source.id, server.source.id, false))
	})
})
