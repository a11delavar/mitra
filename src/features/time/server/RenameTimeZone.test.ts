import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { TimeZone } from '../TimeZone.js'
import { AddTimeZone } from './AddTimeZone.js'
import { RenameTimeZone } from './RenameTimeZone.js'

describe('RenameTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('names a kept zone, and goes back to its place\'s name without one', async () => {
		await AddTimeZone.call({ id: TimeZone.of('Asia/Tokyo') })
		assert.equal((await RenameTimeZone.call({ id: TimeZone.of('Asia/Tokyo'), label: 'Office' })).timeZones?.others[0]?.label, 'Office')
		assert.equal((await RenameTimeZone.call({ id: TimeZone.of('Asia/Tokyo'), label: null })).timeZones?.others[0]?.label, undefined)
	})
})
