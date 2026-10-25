import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { TimeZone } from '#features/time/TimeZone.js'
import { SettleHomeTimeZone } from '#features/time/server/SettleHomeTimeZone.js'
import { CreateSource } from '#features/sources/server/CreateSource.js'
import { SetSourceVisibility } from '#features/sources/server/SetSourceVisibility.js'
import { OperationServer, type SentEntry as Row } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateEntry } from './CreateEntry.js'
import { SearchEntries } from './SearchEntries.js'
import { EntryPatch } from '../EntryPatch.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'

describe('SearchEntries', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('finds entries in hidden calendars too', async () => {
		const archive = await CreateSource.call({ id: server.integration.id, name: 'Archive' })
		await SetSourceVisibility.call({ id: archive.id, hidden: true })
		const start = new DateTime(Date.parse('2026-06-03T09:00:00+02:00'))
		const archived = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: archive.id, type: EntryType.Event, heading: 'Archived review', start, end: start.add({ hours: 1 }) })))
		assert.deepEqual((await SearchEntries.call({ query: 'Archived' })).map(entry => entry.id), [archived.id])
	})

	it('finds nothing for no words', async () => {
		assert.deepEqual(await SearchEntries.call({ query: ' ' }), [])
	})

	describe('as a tool', () => {
		before(() => SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') }))

		it('finds an entry by its words, a repeating one once', async () => {
			const parcel = await server.tool<Row>('create_entry', { heading: 'Pick up parcel', type: 'task', due: '2027-03-05T18:00[Europe/Berlin]' })
			await server.tool('create_entry', { heading: 'Parcel locker check', start: '2026-01-05T09:00[Europe/Berlin]', end: '2026-01-05T09:15[Europe/Berlin]', recurrence: 'FREQ=DAILY' })
			const { items: entries } = await server.tool<{ items: Array<Row> }>('search_entries', { query: 'parcel' })
			assert.deepEqual(entries.map(entry => entry.heading).sort(), ['Parcel locker check', 'Pick up parcel'])
			assert.deepEqual(entries.find(entry => entry.id === parcel.id)?.due, '2027-03-05T17:00:00.000Z')
		})
	})
})
