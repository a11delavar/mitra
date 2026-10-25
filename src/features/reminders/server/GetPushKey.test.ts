import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { GetPushKey } from './GetPushKey.js'

describe('GetPushKey', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the instance\'s public push key, the same every time', async () => {
		const { key } = await GetPushKey.call()
		assert.ok(key.length > 40)
		assert.equal((await GetPushKey.call()).key, key)
	})
})
