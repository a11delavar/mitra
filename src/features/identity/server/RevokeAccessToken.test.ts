import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateAccessToken } from './CreateAccessToken.js'
import { ListAccessTokens } from './ListAccessTokens.js'
import { AccessTokenScope } from '../AccessToken.js'
import { RevokeAccessToken } from './RevokeAccessToken.js'

describe('RevokeAccessToken', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('revokes a token, so it no longer signs an agent in, and a second time finds nothing to refuse', async () => {
		const { accessToken, token } = await CreateAccessToken.call({ name: 'Laptop', scope: AccessTokenScope.Write })
		await RevokeAccessToken.call({ id: accessToken.id })
		assert.deepEqual(await ListAccessTokens.call(), [])
		await RevokeAccessToken.call({ id: accessToken.id })
		const response = await fetch(`${server.url}/mcp`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
		})
		assert.equal(response.status, 401)
	})
})
