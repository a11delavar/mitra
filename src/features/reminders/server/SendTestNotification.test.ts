import { describe, it, before, after } from 'node:test'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { SendTestNotification } from './SendTestNotification.js'

describe('SendTestNotification', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('accepts a rehearsal, which reaches no one without a device', async () => {
		await SendTestNotification.call({ kind: 'task' })
	})
})
