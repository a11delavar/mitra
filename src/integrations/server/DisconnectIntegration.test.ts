import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListIntegrations } from './ListIntegrations.js'
import { DisconnectIntegration } from './DisconnectIntegration.js'

describe('DisconnectIntegration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('disconnects an integration with its calendars', async () => {
		await DisconnectIntegration.call({ id: server.integration.id })
		assert.deepEqual(await ListIntegrations.call(), [])
	})
})
