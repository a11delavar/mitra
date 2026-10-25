import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { TimeZone } from '#features/time/TimeZone.js'
import { SettleHomeTimeZone } from '#features/time/server/SettleHomeTimeZone.js'
import { OperationServer, type SentEntry } from '#infrastructure/operations/OperationServer.testing.js'

type Related = SentEntry & { readonly uid: string, readonly relations: Array<{ readonly type: string, readonly targetUid: string, readonly direction?: string }> }

describe('RelateEntries', () => {
	let server: OperationServer
	before(async () => {
		server = await OperationServer.start()
		await SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') })
	})
	after(() => server.close())

	const task = (heading: string) => server.tool<Related>('create_entry', { heading, type: 'task' })
	const owned = (entry: Related) => entry.relations.filter(relation => relation.direction !== 'incoming').map(relation => [relation.type, relation.targetUid])

	it('adds one relation, keeping the others, and adds it once however often it is asked', async () => {
		const [draft, review, ship] = [await task('Draft'), await task('Review'), await task('Ship')]
		await server.tool('relate_entries', { id: review.id, type: 'FINISHTOSTART', target: draft.id })
		await server.tool('relate_entries', { id: review.id, type: 'PARENT', target: ship.id })
		const related = await server.tool<Related>('relate_entries', { id: review.id, type: 'PARENT', target: ship.id })
		assert.deepEqual(owned(related).sort(), [['FINISHTOSTART', draft.uid], ['PARENT', ship.uid]])
	})

	it('refuses a relation to the entry itself and one that closes a cycle', async () => {
		const [first, second] = [await task('First'), await task('Second')]
		assert.match((await server.callTool('relate_entries', { id: first.id, type: 'FINISHTOSTART', target: first.id })).content[0]!.text, /itself/)
		await server.tool('relate_entries', { id: second.id, type: 'FINISHTOSTART', target: first.id })
		assert.equal((await server.callTool('relate_entries', { id: first.id, type: 'FINISHTOSTART', target: second.id })).isError, true)
	})
})
