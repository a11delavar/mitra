import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { discoverSources, fetchIntegrations } from '../../infrastructure/http/Api.js'
import { OperationServer } from '../../infrastructure/operations/OperationServer.testing.js'

describe('DiscoverSources', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists the calendars an account holds', async () => {
		const [integration] = await fetchIntegrations()
		assert.deepEqual((await discoverSources(integration!)).map(source => source.name), ['Home'])
	})
})
