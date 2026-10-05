import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NotificationSubscription } from './NotificationSubscription.js'
import { asBrowser, wireOf } from '../../infrastructure/model/wire.testing.js'

describe('NotificationSubscription', () => {
	const keys = { p256dh: 'public-key', auth: 'auth-secret' }
	const subscription = () => new NotificationSubscription({ id: 's', userId: 'u', endpoint: 'https://push.example.com/abc', keys, name: 'Phone' })

	describe('register', () => {
		it('restamps what the device reports and keeps the name the user gave it', () => {
			const registered = subscription()
			registered.register('u', { keys, timeZone: 'Europe/Berlin', platform: 'Android', browser: 'Google Chrome', mobile: true })
			assert.equal(registered.name, 'Phone')
			assert.equal(registered.platform, 'Android')
			assert.equal(registered.mobile, true)
			assert.ok(registered.lastSeenAt instanceof Date)
		})

		it('keeps the language when a registration cannot tell it', () => {
			const registered = subscription()
			registered.register('u', { keys, language: 'de' })
			registered.register('u', { keys })
			assert.equal(registered.language, 'de')
		})

		it('forgets the name the previous user gave the device once another user registers it', () => {
			const registered = subscription()
			registered.register('someone-else', { keys })
			assert.equal(registered.userId, 'someone-else')
			assert.equal(registered.name, null)
		})

		it('clears facts the device no longer reports', () => {
			const registered = subscription()
			registered.register('u', { keys, platform: 'Android' })
			registered.register('u', { keys })
			assert.equal(registered.platform, null)
			assert.equal(registered.timeZone, null)
		})
	})

	it('keeps the name and language of the subscription the browser rotated away from', () => {
		const rotated = new NotificationSubscription({ id: 'r', endpoint: 'https://push.example.com/new' })
		rotated.register('u', { keys })
		rotated.succeed(new NotificationSubscription({ ...subscription(), language: 'de' }))
		assert.equal(rotated.name, 'Phone')
		assert.equal(rotated.language, 'de')
	})

	it('falls back to the reported name when renamed to nothing', () => {
		const renamed = subscription()
		renamed.rename(undefined)
		assert.equal(renamed.name, null)
	})

	describe('crossing the API', () => {
		it('answers without the push keys', () => {
			assert.deepEqual(wireOf(subscription()).keys, { p256dh: '', auth: '' })
		})

		it('keeps the endpoint, by which a browser recognizes itself', () => {
			assert.equal(wireOf(subscription()).endpoint, 'https://push.example.com/abc')
		})

		it('carries the keys when it is the browser asking', () => {
			assert.deepEqual(asBrowser(() => wireOf(subscription())).keys, keys)
		})
	})
})
