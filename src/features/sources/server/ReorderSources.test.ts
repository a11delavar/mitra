import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ListIntegrations } from '#integrations/server/ListIntegrations.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateSource } from './CreateSource.js'
import { ReorderSources } from './ReorderSources.js'

describe('ReorderSources', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('puts the calendars in the order given', async () => {
		const work = await CreateSource.call({ id: server.integration.id, name: 'Work' })
		await ReorderSources.call({ ids: [work.id, server.source.id] })
		const [integration] = await ListIntegrations.call()
		const orderOf = (id: string) => integration!.sources.find(source => source.id === id)?.order
		assert.deepEqual([orderOf(work.id), orderOf(server.source.id)], [0, 1])
	})

	it('refuses a calendar the user does not own, and a list with one twice', async () => {
		await assert.rejects(ReorderSources.call({ ids: [server.source.id, crypto.randomUUID()] }))
		await assert.rejects(ReorderSources.call({ ids: [server.source.id, server.source.id] }))
	})
})
