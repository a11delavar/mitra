import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { TimeZone } from '../TimeZone.js'
import { SettleHomeTimeZone } from './SettleHomeTimeZone.js'

describe('SettleHomeTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('takes the first device\'s zone as home, and keeps it when a second device settles', async () => {
		assert.equal((await SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') })).timeZones?.home?.zone.id, 'Europe/Berlin')
		assert.equal((await SettleHomeTimeZone.call({ id: TimeZone.of('Asia/Tokyo') })).timeZones?.home?.zone.id, 'Europe/Berlin')
		assert.equal(server.user.timeZones?.home?.zone.id, 'Europe/Berlin')
	})
})
