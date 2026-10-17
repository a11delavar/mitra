import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setSeenVersion } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('MarkVersionSeen', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('stores the version seen, on the signed-in user too', async () => {
		assert.equal((await setSeenVersion('0.7.0')).lastSeenVersion, '0.7.0')
		assert.equal(server.user.lastSeenVersion, '0.7.0')
	})

	it('refuses a blank version', async () => {
		await assert.rejects(setSeenVersion(' '))
		assert.equal(server.user.lastSeenVersion, '0.7.0')
	})
})
