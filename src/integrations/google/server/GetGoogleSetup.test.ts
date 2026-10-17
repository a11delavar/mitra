import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fetchGoogleAvailability } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('GetGoogleSetup', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers that Google is not set up without its client id and secret', async () => {
		assert.deepEqual(await fetchGoogleAvailability(), { configured: false })
	})
})
