import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ListIntegrations } from '#integrations/server/ListIntegrations.js'
import { GetUser } from '#features/identity/server/GetUser.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateSource } from './CreateSource.js'
import { ShowOnlySource } from './ShowOnlySource.js'

describe('ShowOnlySource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('hides every other calendar, keeping what was hidden before', async () => {
		const work = await CreateSource.call({ id: server.integration.id, name: 'Work' })
		await ShowOnlySource.call({ id: work.id })
		const sources = (await ListIntegrations.call())[0]!.sources
		assert.deepEqual(sources.map(source => [source.name, source.hidden]).sort(), [['Home', true], ['Work', false]])
		assert.deepEqual((await GetUser.call()).previouslyHiddenSourceIds, [])
	})
})
