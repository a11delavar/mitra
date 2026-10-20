import { describe, it, before, after } from 'node:test'
import { Api } from '@a11d/api'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('SendTestNotification', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('accepts a rehearsal, which reaches no one without a device', async () => {
		await Api.post('/push/test', { kind: 'task' })
	})
})
