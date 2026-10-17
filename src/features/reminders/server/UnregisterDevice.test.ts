import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { listDevices, registerDevice } from './devices.testing.js'

describe('UnregisterDevice', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('removes a device by its endpoint', async () => {
		await registerDevice('https://push.example/phone')
		await Api.delete(`/push/subscription?endpoint=${encodeURIComponent('https://push.example/phone')}`)
		assert.deepEqual(await listDevices(), [])
	})

	it('refuses a request without an endpoint', async () => {
		await assert.rejects(Api.delete('/push/subscription'))
	})
})
