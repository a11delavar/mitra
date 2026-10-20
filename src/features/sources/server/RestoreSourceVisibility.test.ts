import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createSource, fetchIntegrations, restoreSourceVisibility, soloSource } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('RestoreSourceVisibility', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('shows the calendars as they were before one was shown alone', async () => {
		const work = await createSource(server.integration.id, { name: 'Work' })
		await soloSource(work.id)
		await restoreSourceVisibility()
		assert.deepEqual((await fetchIntegrations())[0]!.sources.map(source => source.hidden), [false, false])
		assert.equal(server.user.previouslyHiddenSourceIds, undefined)
	})

	it('leaves the calendars as they are when none was shown alone', async () => {
		await restoreSourceVisibility()
		assert.deepEqual((await fetchIntegrations())[0]!.sources.map(source => source.hidden), [false, false])
	})
})
