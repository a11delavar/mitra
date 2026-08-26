import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { IcsSubscription } from './IcsSubscription.js'

// Tests for IcsSubscription URL normalization, capabilities, and credential merging.

describe('Calendar subscription addresses', () => {
	it('accepts a webcal link by fetching it over https — the scheme is a subscribe-to-this marker, not a transport', () => {
		assert.equal(IcsSubscription.normalizeUrl('webcal://example.com/calendar.ics'), 'https://example.com/calendar.ics')
		assert.equal(IcsSubscription.normalizeUrl('WEBCAL://example.com/calendar.ics'), 'https://example.com/calendar.ics')
		assert.equal(IcsSubscription.normalizeUrl('webcals://example.com/calendar.ics'), 'https://example.com/calendar.ics')
	})

	it('leaves a plain http feed alone — a LAN calendar may genuinely have no TLS, exactly as a CalDAV server may', () => {
		assert.equal(IcsSubscription.normalizeUrl('http://nas.local/calendar.ics'), 'http://nas.local/calendar.ics')
	})

	it('trims what was pasted and keeps the query, where most feeds carry their secret', () => {
		assert.equal(IcsSubscription.normalizeUrl('  https://example.com/feed?token=abc  '), 'https://example.com/feed?token=abc')
	})

	it('refuses anything that is not a fetchable address', () => {
		for (const raw of [undefined, '', '   ', 'not a url', 'ftp://example.com/calendar.ics', 'file:///etc/passwd', 'javascript:alert(1)']) {
			assert.equal(IcsSubscription.normalizeUrl(raw), undefined, `${raw} should not be accepted`)
		}
	})
})

describe('Calendar subscription capabilities', () => {
	it('refuses every write — a published feed is a file on someone else\'s server', () => {
		const capabilities = new IcsSubscription().capabilities
		assert.equal(capabilities.createEntries, false)
		assert.equal(capabilities.editEntries, false)
		assert.equal(capabilities.deleteEntries, false)
		assert.equal(capabilities.renameEntries, false)
	})

	it('claims no relation store, since a store that can never be written to is not one to claim authority over', () => {
		assert.equal(new IcsSubscription().capabilities.relations, false)
	})

	it('still holds every field the feed carries, so a subscribed entry shows its place, invitees and repeat rule', () => {
		const capabilities = new IcsSubscription().capabilities
		for (const field of ['recurrence', 'reminders', 'location', 'description', 'participants', 'timeZone', 'transparency', 'visibility', 'allDay'] as const) {
			assert.equal(capabilities[field], true, `${field} should still be readable`)
		}
	})

	it('polls a quarter-hourly at most — a published file behind a cache is no fresher than that', () => {
		assert.equal(new IcsSubscription().syncInterval, 15 * 60_000)
	})
})

describe('Calendar subscription connecting', () => {
	it('needs only the address — auth is the exception, not the gate', () => {
		assert.equal(new IcsSubscription().canConnect, false)
		assert.equal(new IcsSubscription({ uri: 'https://example.com/calendar.ics' }).canConnect, true)
	})

	it('settles its address once: the link IS the identity, so an edit can never re-point it at another calendar', () => {
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

	it('never takes its label from the form — the calendar names itself during discovery', () => {
		const stored = new IcsSubscription({ uri: 'https://example.com/c.ics', credentials: { username: 'Team Holidays' } })
		stored.merge(new IcsSubscription({ credentials: { username: 'Something the user typed' } }))
		assert.equal(stored.credentials.username, 'Team Holidays')
	})
})
