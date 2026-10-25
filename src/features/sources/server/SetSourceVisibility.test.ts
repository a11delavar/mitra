import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ListIntegrations } from '#integrations/server/ListIntegrations.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { SetSourceVisibility } from './SetSourceVisibility.js'

describe('SetSourceVisibility', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const hidden = async () => (await ListIntegrations.call())[0]!.sources.find(source => source.id === server.source.id)?.hidden

	it('hides a calendar and shows it again', async () => {
		await SetSourceVisibility.call({ id: server.source.id, hidden: true })
		assert.equal(await hidden(), true)
		await SetSourceVisibility.call({ id: server.source.id, hidden: false })
		assert.equal(await hidden(), false)
	})
})
