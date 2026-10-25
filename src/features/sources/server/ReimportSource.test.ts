import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ReimportSource } from './ReimportSource.js'

describe('ReimportSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('accepts a re-import, which runs in the background', async () => {
		await ReimportSource.call({ id: server.source.id })
	})

	it('refuses a calendar the user does not own', async () => {
		await assert.rejects(ReimportSource.call({ id: crypto.randomUUID() }))
	})
})
