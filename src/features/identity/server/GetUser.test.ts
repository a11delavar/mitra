import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fetchUser } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('GetUser', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the signed-in user', async () => {
		const user = await fetchUser()
		assert.deepEqual([user.id, user.username], [server.user.id, 'account-owner'])
	})
})
