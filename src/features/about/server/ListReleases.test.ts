import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fetchReleases } from '#infrastructure/http/Api.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

describe('ListReleases', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	it('answers the changelog\'s sections and the release folders', async () => {
		const { sections, folders } = await fetchReleases()
		assert.ok(Array.isArray(sections))
		assert.ok(Array.isArray(folders))
	})
})
