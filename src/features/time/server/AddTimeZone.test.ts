import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { addTimeZone } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('AddTimeZone', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('keeps zones in the order they joined, each once', async () => {
		await addTimeZone('Asia/Tokyo')
		await addTimeZone('America/New_York')
		const { timeZones } = await addTimeZone('Asia/Tokyo')
		assert.deepEqual(timeZones?.others.map(kept => kept.zone.id), ['Asia/Tokyo', 'America/New_York'])
	})

	it('refuses a zone that does not exist', async () => {
		await assert.rejects(addTimeZone('Mars/Olympus'))
	})
})
