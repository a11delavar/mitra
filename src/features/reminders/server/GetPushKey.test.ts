import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('GetPushKey', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the instance\'s public push key, the same every time', async () => {
		const { key } = await Api.get<{ key: string }>('/push/key')
		assert.ok(key.length > 40)
		assert.equal((await Api.get<{ key: string }>('/push/key')).key, key)
	})
})
