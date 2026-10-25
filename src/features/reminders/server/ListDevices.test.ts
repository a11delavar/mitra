import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { registerDevice } from './devices.testing.js'
import { ListDevices } from './ListDevices.js'

describe('ListDevices', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('lists the user\'s devices', async () => {
		assert.deepEqual(await ListDevices.call(), [])
		await registerDevice('https://push.example/phone')
		await registerDevice('https://push.example/laptop')
		assert.deepEqual((await ListDevices.call()).map(device => device.endpoint).sort(), ['https://push.example/laptop', 'https://push.example/phone'])
	})
})
