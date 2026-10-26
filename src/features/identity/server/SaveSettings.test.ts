import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { GetUser } from './GetUser.js'
import { SaveSettings } from './SaveSettings.js'

describe('SaveSettings', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('stores the settings, dropping what no setting knows', async () => {
		await SaveSettings.call({ settings: { snapMinutes: 15, hideDoneTasks: true, unknown: 'dropped' } as never })
		assert.deepEqual({ ...(await GetUser.call()).settings }, { snapMinutes: 15, hideDoneTasks: true })
	})
})
