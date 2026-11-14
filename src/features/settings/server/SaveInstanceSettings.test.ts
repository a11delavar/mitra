import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { GetMeta } from '#features/about/server/GetMeta.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { SaveInstanceSettings } from './SaveInstanceSettings.js'

describe('SaveInstanceSettings', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const administering = (administers: boolean) => server.query('update `user` set `role` = ? where `id` = ?', [administers ? 'administrator' : 'member', server.user.id])

	it('refuses a member, keeping what holds for everyone', async () => {
		await administering(false)
		await assert.rejects(() => SaveInstanceSettings.call({ settings: { customCss: ':root { --color-accent: teal; }' } }))
		assert.equal((await GetMeta.call()).settings, undefined)
	})

	it('keeps an administrator\'s stylesheet for everyone, without its imports, and answers it with the instance', async () => {
		await administering(true)
		const settings = { customCss: '@import "x.css";\n:root { --color-accent: teal; }', customCssEnabled: false, unknown: 'dropped' }
		assert.deepEqual({ ...await SaveInstanceSettings.call({ settings }) }, { customCss: '\n:root { --color-accent: teal; }', customCssEnabled: false })
		assert.deepEqual({ ...(await GetMeta.call()).settings }, { customCss: '\n:root { --color-accent: teal; }', customCssEnabled: false })
	})
})
