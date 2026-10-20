import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { createAccessToken, listAccessTokens } from './accessTokens.testing.js'

describe('ListAccessTokens', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists the user\'s tokens, the newest first, without their hashes', async () => {
		await createAccessToken('Laptop', 'read')
		await new Promise(resolve => setTimeout(resolve, 5))
		await createAccessToken('Automations', 'write')
		const tokens = await listAccessTokens()
		assert.deepEqual(tokens.map(token => token.name), ['Automations', 'Laptop'])
		assert.ok(tokens.every(token => token.hash === ''))
	})
})
