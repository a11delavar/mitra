import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createSource } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('CreateSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('creates a calendar in the integration, a color of its own picked', async () => {
		const work = await createSource(server.integration.id, { name: ' Work ' })
		assert.equal(work.name, 'Work')
		assert.ok(work.color)
		assert.notEqual(work.color, server.source.color)
	})

	it('refuses a calendar without a name', async () => {
		await assert.rejects(createSource(server.integration.id, { name: ' ' }))
	})

	it('creates a calendar for an agent, in an integration get_context names', async () => {
		const { integrations } = await server.tool<{ integrations: Array<{ id: string, can: { createCalendars: boolean } }> }>('get_context')
		assert.deepEqual(integrations.map(integration => [integration.id, integration.can.createCalendars]), [[server.integration.id, true]])
		const sandbox = await server.tool<{ id: string, name: string }>('create_calendar', { id: server.integration.id, name: 'Sandbox' })
		assert.equal(sandbox.name, 'Sandbox')
	})
})
