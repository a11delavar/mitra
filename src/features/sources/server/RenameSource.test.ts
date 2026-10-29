import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { updates, type UpdateScope } from '#infrastructure/realtime/Updates.js'
import { RenameSource } from './RenameSource.js'

describe('RenameSource', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('gives a calendar a name of the user\'s own', async () => {
		const source = await RenameSource.call({ id: server.source.id, name: ' Personal ' })
		assert.equal(source.name, 'Personal')
	})

	it('tells the open pages that the calendars changed', async () => {
		const told = new Array<UpdateScope>()
		const unsubscribe = updates.subscribe((userId, scope) => userId === server.user.id && told.push(scope))
		try {
			await RenameSource.call({ id: server.source.id, name: 'Work' })
			assert.deepEqual(told, ['sources'])
		} finally {
			unsubscribe()
		}
	})

	it('refuses a blank name', async () => {
		await assert.rejects(RenameSource.call({ id: server.source.id, name: ' ' }))
	})
})
