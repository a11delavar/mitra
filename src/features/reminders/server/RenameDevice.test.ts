import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { registerDevice } from './devices.testing.js'
import { RenameDevice } from './RenameDevice.js'

describe('RenameDevice', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('names a device, trimmed', async () => {
		const device = await registerDevice('https://push.example/phone')
		assert.equal((await RenameDevice.call({ id: device.id, name: ' Phone ' })).name, 'Phone')
	})

	it('refuses a device that is not the user\'s', async () => {
		await assert.rejects(RenameDevice.call({ id: crypto.randomUUID(), name: 'Phone' }))
	})
})
