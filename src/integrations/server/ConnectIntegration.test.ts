import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Demo } from '#integrations/demo/Demo.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ConnectIntegration } from './ConnectIntegration.js'

describe('ConnectIntegration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('refuses an integration only a development system offers', async () => {
		await assert.rejects(ConnectIntegration.call({ integration: new Demo({ userId: server.user.id }) }), /development system/)
	})
})
