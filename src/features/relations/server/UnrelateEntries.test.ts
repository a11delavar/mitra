import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { TimeZone } from '#features/time/TimeZone.js'
import { SettleHomeTimeZone } from '#features/time/server/SettleHomeTimeZone.js'
import { OperationServer, type SentEntry } from '#infrastructure/operations/OperationServer.testing.js'

type Related = SentEntry & { readonly uid: string, readonly relations: Array<{ readonly type: string, readonly targetUid: string, readonly direction?: string }> }

describe('UnrelateEntries', () => {
	let server: OperationServer
	before(async () => {
		server = await OperationServer.start()
		await SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') })
	})
	after(() => server.close())

	const task = (heading: string) => server.tool<Related>('create_entry', { heading, type: 'task' })
	const owned = (entry: Related) => entry.relations.filter(relation => relation.direction !== 'incoming').map(relation => [relation.type, relation.targetUid])

	it('removes one relation, keeping the others, and changes nothing for one that is not there', async () => {
		const [draft, review, ship] = [await task('Draft'), await task('Review'), await task('Ship')]
		await server.tool('relate_entries', { id: review.id, type: 'FINISHTOSTART', target: draft.id })
		await server.tool('relate_entries', { id: review.id, type: 'PARENT', target: ship.id })
		const unrelated = await server.tool<Related>('unrelate_entries', { id: review.id, type: 'FINISHTOSTART', target: draft.id })
		assert.deepEqual(owned(unrelated), [['PARENT', ship.uid]])
		const again = await server.tool<Related>('unrelate_entries', { id: review.id, type: 'FINISHTOSTART', target: draft.id })
		assert.deepEqual(owned(again), [['PARENT', ship.uid]])
	})
})
