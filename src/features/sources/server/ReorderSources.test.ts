import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createSource, fetchIntegrations, putSourceOrder } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('ReorderSources', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('puts the calendars in the order given', async () => {
		const work = await createSource(server.integration.id, { name: 'Work' })
		await putSourceOrder([work.id, server.source.id])
		const [integration] = await fetchIntegrations()
		const orderOf = (id: string) => integration!.sources.find(source => source.id === id)?.order
		assert.deepEqual([orderOf(work.id), orderOf(server.source.id)], [0, 1])
	})

	it('refuses a calendar the user does not own, and a list with one twice', async () => {
		await assert.rejects(putSourceOrder([server.source.id, crypto.randomUUID()]))
		await assert.rejects(putSourceOrder([server.source.id, server.source.id]))
	})
})
