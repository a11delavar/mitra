import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, rankEntries } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'

describe('RankTasks', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const rankOf = async (id: string) => (await server.query<{ rank: string | null }>('select rank from entry where id = ?', [id]))[0]?.rank

	it('stores where tasks stand in the manual order', async () => {
		const first = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Task, heading: 'First' }))
		const second = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Task, heading: 'Second' }))
		await rankEntries({ [first.id!]: 'a1', [second.id!]: 'a0' })
		assert.deepEqual([await rankOf(first.id!), await rankOf(second.id!)], ['a1', 'a0'])
	})

	it('refuses an event, which has no place of its own, and a malformed rank', async () => {
		const event = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Lunch', start: new DateTime('2026-07-01T12:00:00Z'), end: new DateTime('2026-07-01T13:00:00Z') }))
		await assert.rejects(rankEntries({ [event.id!]: 'a0' }), /Only tasks have a manual order/)
		await assert.rejects(rankEntries({}), /Ranks must map entry ids to rank keys/)
	})
})
