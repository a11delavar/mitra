import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { listDevices, registerDevice } from './devices.testing.js'

describe('RemoveDevice', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('removes a device, and a second time finds nothing to refuse', async () => {
		const device = await registerDevice('https://push.example/phone')
		await Api.delete(`/push/subscriptions/${device.id}`)
		assert.deepEqual(await listDevices(), [])
		await Api.delete(`/push/subscriptions/${device.id}`)
	})
})
