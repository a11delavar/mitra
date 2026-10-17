import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fetchIntegrations, updateSourceColor } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('RecolorSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('gives a calendar another color', async () => {
		await updateSourceColor(server.source.id, '#3366cc')
		assert.equal((await fetchIntegrations())[0]!.sources[0]!.color, '#3366cc')
	})
})
