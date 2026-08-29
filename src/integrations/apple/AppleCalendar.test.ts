import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AppleCalendar } from './AppleCalendar.js'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'

describe('AppleCalendar', () => {
	it('initializes the uri to the iCloud CalDAV endpoint', () => {
		const calendar = new AppleCalendar({
			credentials: { username: 'test@icloud.com', password: 'password123' }
		})
		assert.equal(calendar.uri, 'https://caldav.icloud.com/')
	})

	it('ignores any uri passed to the constructor', () => {
		const calendar = new AppleCalendar({
			uri: 'https://other.server.com/',
			credentials: { username: 'test@icloud.com', password: 'password123' }
		})
		assert.equal(calendar.uri, 'https://caldav.icloud.com/')
	})

	describe('merge', () => {
		it('preserves the iCloud uri, updates username, and preserves password if omitted', () => {
			const calendar = new AppleCalendar({
				credentials: { username: 'test@icloud.com', password: 'password123' }
			})

			calendar.merge(new AppleCalendar({
				uri: 'https://evil.server.com/',
				credentials: { username: 'new@icloud.com', password: '' }
			}))

			assert.equal(calendar.uri, 'https://caldav.icloud.com/')
			assert.deepEqual(calendar.credentials, { username: 'new@icloud.com', password: 'password123' })
		})
	})

	describe('toString', () => {
		it('returns a tailored label', () => {
			const calendar = new AppleCalendar({
				credentials: { username: 'apple@icloud.com', password: 'abc' }
			})
			assert.equal(calendar.toString(), 'Apple Calendar integration for "apple@icloud.com"')
		})
	})

	describe('crossing the API', () => {
		it('tags itself as itself, not as the provider it extends', () => {
			const calendar = new AppleCalendar({ credentials: { username: 'apple@icloud.com', password: 'abc' }, sources: [] as never })

			assert.equal(wireOf(calendar)['@type'], 'AppleCalendar')
			assert.ok(revive(wireOf(calendar)) instanceof AppleCalendar)
		})
	})
})
