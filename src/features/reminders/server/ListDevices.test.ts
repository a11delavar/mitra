import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { listDevices, registerDevice } from './devices.testing.js'

describe('ListDevices', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists the user\'s devices', async () => {
		assert.deepEqual(await listDevices(), [])
		await registerDevice('https://push.example/phone')
		await registerDevice('https://push.example/laptop')
		assert.deepEqual((await listDevices()).map(device => device.endpoint).sort(), ['https://push.example/laptop', 'https://push.example/phone'])
	})
})
