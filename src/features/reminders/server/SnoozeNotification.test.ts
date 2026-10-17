import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

// A snooze that is taken waits a quarter of an hour on a timer, which would keep the test's process alive.
describe('SnoozeNotification', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('refuses a notification without its facts', async () => {
		await assert.rejects(Api.post('/push/snooze', {}))
	})
})
