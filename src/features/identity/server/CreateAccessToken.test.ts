import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateAccessToken } from './CreateAccessToken.js'
import { AccessTokenScope } from '../AccessToken.js'

describe('CreateAccessToken', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the token this once, keeping only its hash, which it never sends', async () => {
		const { accessToken, token } = await CreateAccessToken.call({ name: '  Laptop  ', scope: AccessTokenScope.Read })
		assert.match(token, /^mitra_[0-9a-f]{64}$/)
		assert.equal(accessToken.name, 'Laptop')
		assert.equal(accessToken.scope, 'read')
		assert.equal(accessToken.hash, '')
		const [row] = await server.query<{ hash: string }>('select hash from access_token where id = ?', [accessToken.id])
		assert.ok(row && row.hash.length === 64 && !row.hash.includes(token))
	})

	it('refuses a token without a name, or with a scope it does not know', async () => {
		await assert.rejects(CreateAccessToken.call({ name: ' ', scope: AccessTokenScope.Read }))
		await assert.rejects(CreateAccessToken.call({ name: 'Laptop', scope: 'admin' as never }))
	})
})
