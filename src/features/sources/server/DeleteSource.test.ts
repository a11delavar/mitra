import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ListIntegrations } from '#integrations/server/ListIntegrations.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateSource } from './CreateSource.js'
import { CountSourceEntries } from './CountSourceEntries.js'
import { DeleteSource } from './DeleteSource.js'

describe('DeleteSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('deletes a calendar, which is then not found', async () => {
		const work = await CreateSource.call({ id: server.integration.id, name: 'Work' })
		await DeleteSource.call({ id: work.id })
		assert.deepEqual((await ListIntegrations.call())[0]!.sources.map(source => source.name), ['Home'])
		await assert.rejects(CountSourceEntries.call({ id: work.id }))
	})

	it('deletes a calendar for an agent', async () => {
		const sandbox = await CreateSource.call({ id: server.integration.id, name: 'Sandbox' })
		await server.tool('delete_calendar', { id: sandbox.id })
		assert.deepEqual((await ListIntegrations.call())[0]!.sources.map(source => source.name), ['Home'])
	})
})
