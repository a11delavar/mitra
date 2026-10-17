import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { deleteIntegration, fetchIntegrations } from '../../infrastructure/http/Api.js'
import { OperationServer } from '../../infrastructure/operations/OperationServer.testing.js'

describe('DisconnectIntegration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('disconnects an integration with its calendars', async () => {
		await deleteIntegration(server.integration.id)
		assert.deepEqual(await fetchIntegrations(), [])
	})
})
