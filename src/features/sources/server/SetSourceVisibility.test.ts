import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fetchIntegrations, toggleSourceVisibility } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('SetSourceVisibility', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const hidden = async () => (await fetchIntegrations())[0]!.sources.find(source => source.id === server.source.id)?.hidden

	it('hides a calendar and shows it again', async () => {
		await toggleSourceVisibility(server.source.id, true)
		assert.equal(await hidden(), true)
		await toggleSourceVisibility(server.source.id, false)
		assert.equal(await hidden(), false)
	})
})
