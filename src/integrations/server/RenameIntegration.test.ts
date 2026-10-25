import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { RenameIntegration } from './RenameIntegration.js'

describe('RenameIntegration', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('gives an integration a name of the user\'s own, shown as its title', async () => {
		const integration = await RenameIntegration.call({ id: server.integration.id, name: ' Work ' })
		assert.equal(integration.name, 'Work')
		assert.equal(integration.title, 'Work')
	})

	it('gives back the account\'s name when renamed to nothing', async () => {
		const integration = await RenameIntegration.call({ id: server.integration.id, name: ' ' })
		assert.equal(integration.name, undefined)
		assert.notEqual(integration.title, '')
	})

	it('refuses an integration the user does not own', async () => {
		await assert.rejects(RenameIntegration.call({ id: crypto.randomUUID(), name: 'Work' }))
	})
})
