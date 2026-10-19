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
		const read = await fetch(`${server.url}/entries/search?query=Holiday&tz=Europe%2FBerlin`)
		assert.equal(read.status, 200)
	})

	it('refuses to delete an occurrence through the address of its entry, which deletes the entry now', async () => {
		const deletion = await fetch(`${server.url}/entries/${crypto.randomUUID()}?scope=this&recurrenceId=2026-10-21T07%3A00%3A00.000Z`, { method: 'DELETE' })
		assert.equal(deletion.status, 409)
	})
})
