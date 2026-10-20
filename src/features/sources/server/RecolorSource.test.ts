import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { fetchIntegrations, updateSourceColor } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { Color } from '../Color.js'

describe('RecolorSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('gives a calendar another color', async () => {
		await updateSourceColor(server.source.id, Color.parse('#3366CC')!)
		assert.equal((await fetchIntegrations())[0]!.sources[0]!.color, Color.parse('#3366cc'))
	})

	it('refuses what is not a color, which would be written into styles', async () => {
		await assert.rejects(Api.put(`/sources/${server.source.id}/color`, { color: 'red; background: url(x)' }))
	})
})
