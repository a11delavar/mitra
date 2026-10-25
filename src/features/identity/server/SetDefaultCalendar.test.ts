import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { SetDefaultCalendar } from './SetDefaultCalendar.js'

describe('SetDefaultCalendar', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('sets the default calendar and clears it', async () => {
		assert.equal((await SetDefaultCalendar.call({ sourceId: server.source.id })).defaultSourceId, server.source.id)
		assert.equal(server.user.defaultSourceId, server.source.id)
		assert.equal((await SetDefaultCalendar.call({ sourceId: null })).defaultSourceId, undefined)
	})

	it('refuses a calendar the user does not own', async () => {
		await assert.rejects(SetDefaultCalendar.call({ sourceId: crypto.randomUUID() }))
	})
})
