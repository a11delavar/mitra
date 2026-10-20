import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fetchUser, setSettings } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('SaveSettings', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('stores the settings, dropping what no setting knows', async () => {
		await setSettings({ snapMinutes: 15, hideDoneTasks: true, unknown: 'dropped' } as never)
		assert.deepEqual({ ...(await fetchUser()).settings }, { snapMinutes: 15, hideDoneTasks: true })
		assert.deepEqual({ ...server.user.settings }, { snapMinutes: 15, hideDoneTasks: true })
	})
})
