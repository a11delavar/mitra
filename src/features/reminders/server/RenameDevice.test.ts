import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { registerDevice } from './devices.testing.js'

describe('RenameDevice', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('names a device, trimmed', async () => {
		const device = await registerDevice('https://push.example/phone')
		assert.equal((await Api.put<{ name?: string }>(`/push/subscriptions/${device.id}/name`, { name: ' Phone ' })).name, 'Phone')
	})

	it('refuses a device that is not the user\'s', async () => {
		await assert.rejects(Api.put(`/push/subscriptions/${crypto.randomUUID()}/name`, { name: 'Phone' }))
	})
})
