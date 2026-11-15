import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ListIntegrations } from '#integrations/server/ListIntegrations.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { SetSourceRoutines } from './SetSourceRoutines.js'

describe('SetSourceRoutines', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('hides a calendar\'s routines, which every calendar shows until then, and shows them again', async () => {
		const disabled = async () => (await ListIntegrations.call())[0]!.sources[0]!.routinesDisabled
		assert.equal(await disabled(), false)
		await SetSourceRoutines.call({ id: server.source.id, disabled: true })
		assert.equal(await disabled(), true)
		await SetSourceRoutines.call({ id: server.source.id, disabled: false })
		assert.equal(await disabled(), false)
	})
})
