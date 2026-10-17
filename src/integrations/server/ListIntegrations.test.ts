import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fetchIntegrations } from '../../infrastructure/http/Api.js'
import { OperationServer } from '../../infrastructure/operations/OperationServer.testing.js'

describe('ListIntegrations', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists the user\'s integrations with their calendars', async () => {
		const integrations = await fetchIntegrations()
		assert.deepEqual(integrations.map(integration => [integration.id, integration.sources.map(source => source.name)]), [[server.integration.id, ['Home']]])
	})
})
