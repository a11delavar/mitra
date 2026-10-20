import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setDefaultSource } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('SetDefaultCalendar', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('sets the default calendar and clears it', async () => {
		assert.equal((await setDefaultSource(server.source.id)).defaultSourceId, server.source.id)
		assert.equal(server.user.defaultSourceId, server.source.id)
		assert.equal((await setDefaultSource(undefined)).defaultSourceId, undefined)
	})

	it('refuses a calendar the user does not own', async () => {
		await assert.rejects(setDefaultSource(crypto.randomUUID()))
	})
})
