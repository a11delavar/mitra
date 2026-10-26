import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { GetUser } from '#features/identity/server/GetUser.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { TimeZone } from '../TimeZone.js'
import { SettleHomeTimeZone } from './SettleHomeTimeZone.js'
import { MakeHomeTimeZone } from './MakeHomeTimeZone.js'

describe('MakeHomeTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('makes another zone home, the former home taking its place among the others', async () => {
		await SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') })
		const { timeZones } = await MakeHomeTimeZone.call({ id: TimeZone.of('Asia/Tokyo') })
		assert.equal(timeZones?.home?.zone.id, 'Asia/Tokyo')
		assert.deepEqual(timeZones?.others.map(kept => kept.zone.id), ['Europe/Berlin'])
		assert.equal((await GetUser.call()).timeZones?.home?.zone.id, 'Asia/Tokyo')
	})
})
