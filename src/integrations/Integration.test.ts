import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CalDAV } from './caldav/CalDAV.js'
import { Source } from '../features/sources/Source.js'

describe('Integration', () => {
	describe('clone', () => {
		it('is the same provider class, keeping the identity and the credentials as held', () => {
			const copy = new CalDAV({ uri: 'https://dav/', credentials: { username: 'u', password: '' }, sources: [] }).clone()
			assert.ok(copy instanceof CalDAV)
			assert.equal(copy.uri, 'https://dav/')
			assert.deepEqual(copy.credentials, { username: 'u', password: '' })
		})

		it('holds nothing the listed one holds: editing its credentials and calendars changes nothing listed', () => {
			const held = new CalDAV({ id: 'i', uri: 'https://dav/', credentials: { username: 'u', password: '' }, sources: [new Source({ uri: 'https://dav/cal/', name: 'Home', enabled: true })] })
			const copy = held.clone()
			assert.equal(copy.is(held), true)
			copy.credentials.password = 'typed'
			copy.sources.forEach(source => source.enabled = false)
			assert.equal(held.credentials.password, '')
			assert.equal(held.sources[0]!.enabled, true)
		})
	})
})
