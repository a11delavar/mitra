import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fetchIntegrations, updateIntegration } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('UpdateIntegration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the integration as it now stands', async () => {
		const [integration] = await fetchIntegrations()
		const saved = await updateIntegration(integration!)
		assert.deepEqual([saved.id, saved.sources.map(source => source.name)], [server.integration.id, ['Home']])
	})
})
