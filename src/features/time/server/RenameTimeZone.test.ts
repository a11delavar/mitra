import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { addTimeZone, renameTimeZone } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('RenameTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('names a kept zone, and goes back to its place\'s name without one', async () => {
		await addTimeZone('Asia/Tokyo')
		assert.equal((await renameTimeZone('Asia/Tokyo', 'Office')).timeZones?.others[0]?.label, 'Office')
		assert.equal((await renameTimeZone('Asia/Tokyo', undefined)).timeZones?.others[0]?.label, undefined)
	})
})
