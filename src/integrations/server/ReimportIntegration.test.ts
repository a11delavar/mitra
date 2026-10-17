import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { reimportIntegration } from '../../infrastructure/http/Api.js'
import { OperationServer } from '../../infrastructure/operations/OperationServer.testing.js'

describe('ReimportIntegration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('accepts a re-import, which runs in the background', async () => {
		await reimportIntegration(server.integration.id)
	})

	it('refuses an integration the user does not own', async () => {
		await assert.rejects(reimportIntegration(crypto.randomUUID()))
	})
})
