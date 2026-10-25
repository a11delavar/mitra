import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { GetGoogleSetup } from './GetGoogleSetup.js'

describe('GetGoogleSetup', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers that Google is not set up without its client id and secret', async () => {
		assert.deepEqual(await GetGoogleSetup.call(), { configured: false })
	})
})
