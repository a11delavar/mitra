import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { MarkVersionSeen } from './MarkVersionSeen.js'

describe('MarkVersionSeen', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('stores the version seen, on the signed-in user too', async () => {
		assert.equal((await MarkVersionSeen.call({ version: '0.7.0' })).lastSeenVersion, '0.7.0')
		assert.equal(server.user.lastSeenVersion, '0.7.0')
	})

	it('refuses a blank version', async () => {
		await assert.rejects(MarkVersionSeen.call({ version: ' ' }))
		assert.equal(server.user.lastSeenVersion, '0.7.0')
	})
})
