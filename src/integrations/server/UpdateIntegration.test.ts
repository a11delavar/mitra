import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListIntegrations } from './ListIntegrations.js'
import { UpdateIntegration } from './UpdateIntegration.js'

describe('UpdateIntegration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the integration as it now stands', async () => {
		const [integration] = await ListIntegrations.call()
		const saved = await UpdateIntegration.call({ id: integration!.id, integration: integration! })
		assert.deepEqual([saved.id, saved.sources.map(source => source.name)], [server.integration.id, ['Home']])
	})
})
