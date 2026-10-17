import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { countSourceEntries, createEvent, createSource, migrateSourceEntries } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Entry } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'

describe('MigrateSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('moves a calendar\'s entries into another', async () => {
		const work = await createSource(server.integration.id, { name: 'Work' })
		await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Standup', start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T09:15:00Z') }))
		await migrateSourceEntries(server.source.id, { targetSourceId: work.id, flatten: false, keepOriginals: false })
		assert.equal(await countSourceEntries(server.source.id), 0)
		assert.equal(await countSourceEntries(work.id), 1)
	})

	it('copies them, keeping the originals', async () => {
		const copies = await createSource(server.integration.id, { name: 'Copies' })
		await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Review', start: new DateTime('2026-07-02T09:00:00Z'), end: new DateTime('2026-07-02T10:00:00Z') }))
		await migrateSourceEntries(server.source.id, { targetSourceId: copies.id, flatten: false, keepOriginals: true })
		assert.equal(await countSourceEntries(server.source.id), 1)
		assert.equal(await countSourceEntries(copies.id), 1)
	})
})
