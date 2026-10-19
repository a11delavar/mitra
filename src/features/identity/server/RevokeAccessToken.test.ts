import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { createAccessToken, listAccessTokens } from './accessTokens.testing.js'

describe('RevokeAccessToken', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('revokes a token, so it no longer signs an agent in, and a second time finds nothing to refuse', async () => {
		const { accessToken, token } = await createAccessToken('Laptop', 'write')
		await Api.delete(`/user/access-tokens/${accessToken.id}`)
		assert.deepEqual(await listAccessTokens(), [])
		await Api.delete(`/user/access-tokens/${accessToken.id}`)
		const response = await fetch(`${server.url}/mcp`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
		})
		assert.equal(response.status, 401)
	})
})
