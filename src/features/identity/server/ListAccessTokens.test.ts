import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateAccessToken } from './CreateAccessToken.js'
import { ListAccessTokens } from './ListAccessTokens.js'
import { AccessTokenScope } from '../AccessToken.js'

describe('ListAccessTokens', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists the user\'s tokens, the newest first, without their hashes', async () => {
		await CreateAccessToken.call({ name: 'Laptop', scope: AccessTokenScope.Read })
		await new Promise(resolve => setTimeout(resolve, 5))
		await CreateAccessToken.call({ name: 'Automations', scope: AccessTokenScope.Write })
		const tokens = await ListAccessTokens.call()
		assert.deepEqual(tokens.map(token => token.name), ['Automations', 'Laptop'])
		assert.ok(tokens.every(token => token.hash === ''))
	})
})
