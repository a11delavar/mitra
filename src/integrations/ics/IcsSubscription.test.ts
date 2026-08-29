import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { IcsSubscription } from './IcsSubscription.js'

describe('Calendar subscription addresses', () => {
	it('accepts a webcal link by fetching it over https', () => {
		assert.equal(IcsSubscription.normalizeUrl('webcal://example.com/calendar.ics'), 'https://example.com/calendar.ics')
		assert.equal(IcsSubscription.normalizeUrl('WEBCAL://example.com/calendar.ics'), 'https://example.com/calendar.ics')
		assert.equal(IcsSubscription.normalizeUrl('webcals://example.com/calendar.ics'), 'https://example.com/calendar.ics')
	})

	it('leaves a plain http feed alone', () => {
		assert.equal(IcsSubscription.normalizeUrl('http://nas.local/calendar.ics'), 'http://nas.local/calendar.ics')
	})

	it('trims whitespace and preserves query parameters', () => {
		assert.equal(IcsSubscription.normalizeUrl('  https://example.com/feed?token=abc  '), 'https://example.com/feed?token=abc')
	})

	it('refuses anything that is not a fetchable address', () => {
		for (const raw of [undefined, '', '   ', 'not a url', 'ftp://example.com/calendar.ics', 'file:///etc/passwd', 'javascript:alert(1)']) {
			assert.equal(IcsSubscription.normalizeUrl(raw), undefined, `${raw} should not be accepted`)
		}
	})
})

describe('Calendar subscription capabilities', () => {
	it('refuses writes', () => {
		const capabilities = new IcsSubscription().capabilities
		assert.equal(capabilities.createEntries, false)
		assert.equal(capabilities.editEntries, false)
		assert.equal(capabilities.deleteEntries, false)
		assert.equal(capabilities.renameEntries, false)
	})

	it('claims no relation store', () => {
		assert.equal(new IcsSubscription().capabilities.relations, false)
	})

	it('preserves readable entry fields', () => {
		const capabilities = new IcsSubscription().capabilities
		for (const field of ['recurrence', 'reminders', 'location', 'description', 'participants', 'timeZone', 'transparency', 'visibility', 'allDay'] as const) {
			assert.equal(capabilities[field], true, `${field} should still be readable`)
		}
	})

	it('polls with 15-minute sync interval', () => {
		assert.equal(new IcsSubscription().syncInterval, 15 * 60_000)
	})
})

describe('Calendar subscription connecting', () => {
	it('needs only the address to connect', () => {
		assert.equal(new IcsSubscription().canConnect, false)
		assert.equal(new IcsSubscription({ uri: 'https://example.com/calendar.ics' }).canConnect, true)
	})

	it('preserves uri on merge', () => {
		const stored = new IcsSubscription({ uri: 'https://example.com/first.ics' })
		stored.merge(new IcsSubscription({ uri: 'https://example.com/second.ics' }))
		assert.equal(stored.uri, 'https://example.com/first.ics')
	})

	it('normalizes the address it is first given', () => {
		const fresh = new IcsSubscription()
		fresh.merge(new IcsSubscription({ uri: 'webcal://example.com/calendar.ics' }))
		assert.equal(fresh.uri, 'https://example.com/calendar.ics')
	})

	it('keeps the stored password when the form leaves it blank, and rotates it when one is typed', () => {
		const stored = new IcsSubscription({ uri: 'https://example.com/c.ics', credentials: { username: 'Holidays', authUsername: 'reader', password: 'stored-secret' } })
		stored.merge(new IcsSubscription({ credentials: { username: '', password: '' } }))
		assert.equal(stored.credentials.password, 'stored-secret')

		stored.merge(new IcsSubscription({ credentials: { username: '', authUsername: 'reader', password: 'rotated' } }))
		assert.equal(stored.credentials.password, 'rotated')
	})

	it('never takes its label from the form', () => {
		const stored = new IcsSubscription({ uri: 'https://example.com/c.ics', credentials: { username: 'Team Holidays' } })
		stored.merge(new IcsSubscription({ credentials: { username: 'Something the user typed' } }))
		assert.equal(stored.credentials.username, 'Team Holidays')
	})
})
