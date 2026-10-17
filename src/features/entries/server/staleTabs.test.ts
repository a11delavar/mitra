import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('staleTabs', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('refuses a write from a tab from before days traveled as days, which would store its own midnights, and lets it read', async () => {
		const write = await fetch(`${server.url}/entries/${crypto.randomUUID()}?tz=Europe%2FBerlin`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' })
		assert.equal(write.status, 409)
		const read = await fetch(`${server.url}/entries/search?q=Holiday&tz=Europe%2FBerlin`)
		assert.equal(read.status, 200)
	})
})
