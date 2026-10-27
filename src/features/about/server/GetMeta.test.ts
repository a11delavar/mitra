import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { Instance } from '../Instance.js'
import { GetMeta } from './GetMeta.js'

describe('GetMeta', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the instance: the running version and the file limits', async () => {
		const instance = await GetMeta.call()
		assert.ok(instance instanceof Instance)
		assert.equal(instance.version, mitra.version)
		assert.equal(instance.stale, false)
		assert.ok(instance.files!.maxSize > 0)
	})
})
