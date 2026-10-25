import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { registerDevice } from './devices.testing.js'
import { ListDevices } from './ListDevices.js'
import { RenameDevice } from './RenameDevice.js'

describe('RegisterDevice', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('registers a device once however often it registers', async () => {
		await registerDevice('https://push.example/a')
		await registerDevice('https://push.example/a')
		assert.deepEqual((await ListDevices.call()).map(device => device.endpoint), ['https://push.example/a'])
	})

	it('hands a rotated subscription its predecessor\'s name', async () => {
		const first = await registerDevice('https://push.example/b')
		await RenameDevice.call({ id: first.id, name: 'Laptop' })
		const rotated = await registerDevice('https://push.example/c', { previousEndpoint: 'https://push.example/b' })
		assert.equal(rotated.name, 'Laptop')
		assert.ok(!(await ListDevices.call()).some(device => device.endpoint === 'https://push.example/b'))
	})

	it('refuses a subscription without its keys', async () => {
		await assert.rejects(Api.post('/push/subscription', { endpoint: 'https://push.example/d' }))
	})
})
