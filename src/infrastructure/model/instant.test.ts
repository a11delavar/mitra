import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ValidationError } from '#infrastructure/validation'
import { Source } from '#features/sources'
import { AccessToken } from '#features/identity'
import { NotificationSubscription } from '#features/reminders/NotificationSubscription.js'
import { revive, wireOf } from './wire.testing.js'
import { instant } from './instant.js'

describe('instant', () => {
	it('reads a point in time from its text', () => {
		const read = instant.construct('2026-10-14T16:30:00.000Z')
		assert.ok(read instanceof Date)
		assert.equal(read.toISOString(), '2026-10-14T16:30:00.000Z')
	})

	it('keeps a date, and an absent or cleared one, as it is', () => {
		const date = new Date('2026-10-14T16:30:00Z')
		assert.equal(instant.construct(date), date)
		assert.equal(instant.construct(undefined), undefined)
		assert.equal(instant.construct(null), null)
	})

	it('refuses text that names no point in time', () => {
		assert.throws(() => instant.construct('yesterday'), ValidationError)
	})

	// Without a reviver for dates, each field holding one reads its own text.
	it('gives every plain date field a date across the wire', () => {
		const at = new Date('2026-10-14T16:30:00.000Z')
		const source = revive<Source>(wireOf(new Source({ uri: 'mitra://local', name: 'Personal', importedAt: at })))
		const token = revive<AccessToken>(wireOf(Object.assign(new AccessToken(), { createdAt: at, lastUsedAt: at })))
		const device = revive<NotificationSubscription>(wireOf(Object.assign(new NotificationSubscription(), { lastSeenAt: at })))
		for (const value of [source.importedAt, token.createdAt, token.lastUsedAt, device.lastSeenAt]) {
			assert.ok(value instanceof Date, String(value))
			assert.equal(value.toISOString(), at.toISOString())
		}
	})
})
