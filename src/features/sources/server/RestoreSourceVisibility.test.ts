import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ListIntegrations } from '#integrations/server/ListIntegrations.js'
import { GetUser } from '#features/identity/server/GetUser.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { CreateSource } from './CreateSource.js'
import { RestoreSourceVisibility } from './RestoreSourceVisibility.js'
import { ShowOnlySource } from './ShowOnlySource.js'

describe('RestoreSourceVisibility', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('shows the calendars as they were before one was shown alone', async () => {
		const work = await CreateSource.call({ id: server.integration.id, name: 'Work' })
		await ShowOnlySource.call({ id: work.id })
		await RestoreSourceVisibility.call()
		assert.deepEqual((await ListIntegrations.call())[0]!.sources.map(source => source.hidden), [false, false])
		assert.equal((await GetUser.call()).previouslyHiddenSourceIds, undefined)
	})

	it('leaves the calendars as they are when none was shown alone', async () => {
		await RestoreSourceVisibility.call()
		assert.deepEqual((await ListIntegrations.call())[0]!.sources.map(source => source.hidden), [false, false])
	})
})
