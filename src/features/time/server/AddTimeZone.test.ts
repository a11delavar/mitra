import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { TimeZone } from '../TimeZone.js'
import { AddTimeZone } from './AddTimeZone.js'

describe('AddTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('keeps zones in the order they joined, each once', async () => {
		await AddTimeZone.call({ id: TimeZone.of('Asia/Tokyo') })
		await AddTimeZone.call({ id: TimeZone.of('America/New_York') })
		const { timeZones } = await AddTimeZone.call({ id: TimeZone.of('Asia/Tokyo') })
		assert.deepEqual(timeZones?.others.map(kept => kept.zone.id), ['Asia/Tokyo', 'America/New_York'])
	})

	it('refuses a zone that does not exist', async () => {
		// Written as it arrives, as no `TimeZone` holds a zone that does not exist.
		await assert.rejects(Api.post('/user/time-zones', { id: 'Mars/Olympus' }))
	})
})
