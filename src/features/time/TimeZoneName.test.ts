import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TimeZone } from './TimeZone.js'
import { TimeZoneName } from './TimeZoneName.js'

const summer = new Date(Date.UTC(2026, 6, 9, 12))
const name = (id: string, locale: string) => new TimeZoneName(TimeZone.of(id), new Intl.Locale(locale), summer)

describe('TimeZoneName', () => {
	it('takes the abbreviation the reader\'s region uses', () => {
		assert.equal(name('America/New_York', 'en-US').short, 'EDT')
		assert.equal(name('Europe/Berlin', 'de-DE').short, 'MESZ')
		assert.equal(name('Europe/London', 'en-GB').short, 'BST')
	})

	it('takes the abbreviation of the zone\'s own region where the reader has none', () => {
		assert.equal(name('Europe/London', 'de-DE').short, 'BST')
		assert.equal(name('America/New_York', 'de-DE').short, 'EDT')
		assert.equal(name('Europe/Berlin', 'en-US').short, 'CEST')
	})

	it('names the place where no abbreviation is in use, in the reader\'s language', () => {
		assert.equal(name('Asia/Tehran', 'en-US').short, 'Iran')
		assert.equal(name('Asia/Tehran', 'fa-IR').short, 'ایران')
		assert.equal(name('Asia/Tokyo', 'de-DE').short, 'Japan')
	})

	it('keeps Latin abbreviations away from a reader in another script', () => {
		assert.equal(name('Europe/London', 'fa-IR').short, 'بریتانیا')
	})

	it('knows a zone\'s name the year round and its city', () => {
		assert.equal(name('Europe/Berlin', 'de-DE').generic, 'Mitteleuropäische Zeit')
		assert.equal(name('America/New_York', 'en-US').city, 'New York')
		assert.equal(name('UTC', 'en-US').short, 'UTC')
	})
})
