import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListIntegrations } from './ListIntegrations.js'

describe('ListIntegrations', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists the user\'s integrations with their calendars', async () => {
		const integrations = await ListIntegrations.call()
		assert.deepEqual(integrations.map(integration => [integration.id, integration.sources.map(source => source.name)]), [[server.integration.id, ['Home']]])
	})
})
