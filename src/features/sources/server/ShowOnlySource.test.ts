import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createSource, fetchIntegrations, soloSource } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('ShowOnlySource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('hides every other calendar, keeping what was hidden before', async () => {
		const work = await createSource(server.integration.id, { name: 'Work' })
		await soloSource(work.id)
		const sources = (await fetchIntegrations())[0]!.sources
		assert.deepEqual(sources.map(source => [source.name, source.hidden]).sort(), [['Home', true], ['Work', false]])
		assert.deepEqual(server.user.previouslyHiddenSourceIds, [])
	})
})
