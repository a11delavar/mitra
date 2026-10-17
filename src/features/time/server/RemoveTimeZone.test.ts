import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { addTimeZone, removeTimeZone, settleTimeZone } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('RemoveTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('removes a kept zone, addressed by its id in the path, and never home', async () => {
		await settleTimeZone('Europe/Berlin')
		await addTimeZone('America/New_York')
		assert.deepEqual((await removeTimeZone('America/New_York')).timeZones?.others, [])
		assert.equal((await removeTimeZone('Europe/Berlin')).timeZones?.home?.zone.id, 'Europe/Berlin')
	})
})
