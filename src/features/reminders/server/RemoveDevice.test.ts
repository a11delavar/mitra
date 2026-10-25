import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { registerDevice } from './devices.testing.js'
import { ListDevices } from './ListDevices.js'
import { RemoveDevice } from './RemoveDevice.js'

describe('RemoveDevice', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('removes a device, and a second time finds nothing to refuse', async () => {
		const device = await registerDevice('https://push.example/phone')
		await RemoveDevice.call({ id: device.id })
		assert.deepEqual(await ListDevices.call(), [])
		await RemoveDevice.call({ id: device.id })
	})
})
