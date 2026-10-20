import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { makeHomeTimeZone, settleTimeZone } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('MakeHomeTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('makes another zone home, the former home taking its place among the others', async () => {
		await settleTimeZone('Europe/Berlin')
		const { timeZones } = await makeHomeTimeZone('Asia/Tokyo')
		assert.equal(timeZones?.home?.zone.id, 'Asia/Tokyo')
		assert.deepEqual(timeZones?.others.map(kept => kept.zone.id), ['Europe/Berlin'])
		assert.equal(server.user.timeZones?.home?.zone.id, 'Asia/Tokyo')
	})
})
