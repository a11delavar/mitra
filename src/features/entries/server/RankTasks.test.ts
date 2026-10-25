import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateEntry } from './CreateEntry.js'
import { RankTasks } from './RankTasks.js'
import { EntryRank } from '../EntryRank.js'
import { EntryPatch } from '../EntryPatch.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'

describe('RankTasks', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const rankOf = async (id: string) => (await server.query<{ rank: string | null }>('select rank from entry where id = ?', [id]))[0]?.rank

	it('stores where tasks stand in the manual order', async () => {
		const first = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Task, heading: 'First' })))
		const second = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Task, heading: 'Second' })))
		await RankTasks.call({ ranks: [[first.id!, EntryRank.parse('a1')], [second.id!, EntryRank.parse('a0')]] })
		assert.deepEqual([await rankOf(first.id!), await rankOf(second.id!)], ['a1', 'a0'])
	})

	it('refuses an event, which has no place of its own, and a malformed rank', async () => {
		const event = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Lunch', start: new DateTime('2026-07-01T12:00:00Z'), end: new DateTime('2026-07-01T13:00:00Z') })))
		await assert.rejects(RankTasks.call({ ranks: [[event.id!, EntryRank.parse('a0')]] }), /Only tasks have a manual order/)
		await assert.rejects(RankTasks.call({ ranks: [] }), /Ranks must map entry ids to rank keys/)
	})
})
