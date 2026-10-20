import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { putIntegrationOrder } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('ReorderIntegrations', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('takes the order of the user\'s integrations', async () => {
		await putIntegrationOrder([server.integration.id])
	})

	it('refuses an integration the user does not own, and an empty list', async () => {
		await assert.rejects(putIntegrationOrder([server.integration.id, crypto.randomUUID()]))
		await assert.rejects(putIntegrationOrder([]))
	})
})
