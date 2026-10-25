import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { TimeZone } from '../TimeZone.js'
import { SettleHomeTimeZone } from './SettleHomeTimeZone.js'
import { AddTimeZone } from './AddTimeZone.js'
import { RemoveTimeZone } from './RemoveTimeZone.js'

describe('RemoveTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('removes a kept zone, addressed by its id in the path, and never home', async () => {
		await SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') })
		await AddTimeZone.call({ id: TimeZone.of('America/New_York') })
		assert.deepEqual((await RemoveTimeZone.call({ id: TimeZone.of('America/New_York') })).timeZones?.others, [])
		assert.equal((await RemoveTimeZone.call({ id: TimeZone.of('Europe/Berlin') })).timeZones?.home?.zone.id, 'Europe/Berlin')
	})
})
