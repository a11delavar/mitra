import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListIntegrations } from './ListIntegrations.js'
import { DiscoverSources } from './DiscoverSources.js'

describe('DiscoverSources', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists the calendars an account holds', async () => {
		const [integration] = await ListIntegrations.call()
		assert.deepEqual((await DiscoverSources.call({ integration: integration! })).map(source => source.name), ['Home'])
	})
})
