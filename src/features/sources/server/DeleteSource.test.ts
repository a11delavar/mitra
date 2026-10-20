import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { countSourceEntries, createSource, deleteSource, fetchIntegrations } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('DeleteSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('deletes a calendar, which is then not found', async () => {
		const work = await createSource(server.integration.id, { name: 'Work' })
		await deleteSource(work.id)
		assert.deepEqual((await fetchIntegrations())[0]!.sources.map(source => source.name), ['Home'])
		await assert.rejects(countSourceEntries(work.id))
	})

	it('deletes a calendar for an agent', async () => {
		const sandbox = await createSource(server.integration.id, { name: 'Sandbox' })
		await server.tool('delete_calendar', { id: sandbox.id })
		assert.deepEqual((await fetchIntegrations())[0]!.sources.map(source => source.name), ['Home'])
	})
})
