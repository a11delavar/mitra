import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { renameSource } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'

describe('RenameSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('gives a calendar a name of the user\'s own', async () => {
		assert.equal((await renameSource(server.source.id, ' Personal ')).name, 'Personal')
	})

	it('refuses a blank name', async () => {
		await assert.rejects(renameSource(server.source.id, ' '))
	})
})
