import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { UpdateChecker } from './updates.js'

describe('UpdateChecker.check', () => {
	const stub = (answers: Record<string, unknown>) => (url: string) => {
		const match = Object.entries(answers).find(([needle]) => url.includes(needle))
		return match ? Promise.resolve(match[1]) : Promise.reject(new Error(`404: ${url}`))
	}

	describe('release channel', () => {
		it('reports a newer stable from the manifest asset', async () => {
			const checker = new UpdateChecker('v0.3.0', stub({
				'releases/latest/download/mitra.json': { version: 'v0.4.0', url: 'https://github.com/a11delavar/mitra/releases/tag/v0.4.0' },
			}))
			assert.deepEqual(await checker.check(), { version: 'v0.4.0', url: 'https://github.com/a11delavar/mitra/releases/tag/v0.4.0' })
		})

		it('falls back to the releases API when the manifest asset is missing', async () => {
			const checker = new UpdateChecker('v0.3.0', stub({
				'api.github.com': { tag_name: 'v0.4.0', html_url: 'https://github.com/a11delavar/mitra/releases/tag/v0.4.0' },
			}))
			assert.deepEqual(await checker.check(), { version: 'v0.4.0', url: 'https://github.com/a11delavar/mitra/releases/tag/v0.4.0' })
		})

		it('stays silent when already on the latest', async () => {
			const checker = new UpdateChecker('v0.4.0', stub({
				'releases/latest/download/mitra.json': { version: 'v0.4.0', url: '…' },
			}))
			assert.equal(await checker.check(), undefined)
		})

		it('stays silent when running AHEAD of the latest release', async () => {
			const checker = new UpdateChecker('v0.5.0', stub({
				'releases/latest/download/mitra.json': { version: 'v0.4.0', url: '…' },
			}))
			assert.equal(await checker.check(), undefined)
		})

		it('propagates a full outage to the caller (tick() is what swallows it)', async () => {
			const checker = new UpdateChecker('v0.3.0', () => Promise.reject(new Error('offline')))
			await assert.rejects(checker.check())
		})
	})

	describe('prerelease channel', () => {
		it('reports the stable that supersedes the running pre-release', async () => {
			const checker = new UpdateChecker('v1.0.0-rc.1', stub({
				'releases/latest/download/mitra.json': { version: 'v1.0.0', url: 'https://github.com/a11delavar/mitra/releases/tag/v1.0.0' },
			}))
			assert.deepEqual(await checker.check(), { version: 'v1.0.0', url: 'https://github.com/a11delavar/mitra/releases/tag/v1.0.0' })
		})

		it('ignores the older stable the pre-release is already past', async () => {
			const checker = new UpdateChecker('v1.0.0-rc.1', stub({
				'releases/latest/download/mitra.json': { version: 'v0.9.0', url: '…' },
			}))
			assert.equal(await checker.check(), undefined)
		})
	})

	describe('dev channel', () => {
		it('reports how far main has moved past the baked commit', async () => {
			const checker = new UpdateChecker('v0.3.0-14-gabc1234', stub({
				'compare/abc1234...main': { ahead_by: 14, html_url: 'https://github.com/a11delavar/mitra/compare/abc1234...main', commits: [{ sha: 'def5678900' }] },
			}))
			assert.deepEqual(await checker.check(), { version: 'def5678', url: 'https://github.com/a11delavar/mitra/compare/abc1234...main', commits: 14 })
		})

		it('stays silent when the baked commit IS main', async () => {
			const checker = new UpdateChecker('v0.3.0-14-gabc1234', stub({
				'compare/abc1234...main': { ahead_by: 0, html_url: '…', commits: [] },
			}))
			assert.equal(await checker.check(), undefined)
		})
	})

	it('never checks without a channel', async () => {
		let called = false
		const checker = new UpdateChecker('dev', () => { called = true; return Promise.resolve({}) })
		assert.equal(await checker.check(), undefined)
		assert.equal(called, false)
	})
})
