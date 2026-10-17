import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('GetMeta', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the running version and the file limits', async () => {
		const meta = await Api.get<{ version: string, files: { maxSize: number } }>('/meta')
		assert.equal(meta.version, mitra.version)
		assert.ok(meta.files.maxSize > 0)
	})
})
