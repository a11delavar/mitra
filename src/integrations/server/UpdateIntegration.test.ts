import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListIntegrations } from './ListIntegrations.js'
import { RenameIntegration } from './RenameIntegration.js'
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

	it('keeps the name the integration was renamed to, whatever the dialog sends', async () => {
		await RenameIntegration.call({ id: server.integration.id, name: 'Collaborator' })
		const [integration] = await ListIntegrations.call()
		integration!.name = undefined
		assert.equal((await UpdateIntegration.call({ id: integration!.id, integration: integration! })).name, 'Collaborator')
	})
})
