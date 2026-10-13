import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TimeZone } from './TimeZone.js'

const summer = new Date(Date.UTC(2026, 6, 9, 12))

describe('TimeZone', () => {
	it('is one instance per zone, however its id is cased', () => {
		assert.equal(TimeZone.of('Europe/Berlin'), TimeZone.of('Europe/Berlin'))
		assert.equal(TimeZone.of('europe/berlin'), TimeZone.of('Europe/Berlin'))
		assert.equal(TimeZone.of('europe/berlin').id, 'Europe/Berlin')
	})

	it('refuses a zone the runtime does not know, and parses only what names one', () => {
		assert.throws(() => TimeZone.of('Mars/Olympus'), RangeError)
		assert.equal(TimeZone.parse('Mars/Olympus'), undefined)
		assert.equal(TimeZone.parse(42), undefined)
		assert.equal(TimeZone.parse(''), undefined)
		assert.equal(TimeZone.parse('Asia/Tokyo'), TimeZone.of('Asia/Tokyo'))
	})

	it('equals its aliases but not a zone with the same clock', () => {
		assert.ok(TimeZone.of('Asia/Calcutta').equals(TimeZone.of('Asia/Kolkata')))
		assert.ok(TimeZone.of('UTC').equals(TimeZone.of('Etc/UTC')))
		assert.ok(!TimeZone.of('Europe/Berlin').equals(TimeZone.of('Europe/Paris')))
		// Native Temporal merges these, as IANA links Oslo to Berlin; CLDR keeps them apart, and so must Mitra on every engine.
		assert.ok(!TimeZone.of('Europe/Berlin').equals(TimeZone.of('Europe/Oslo')))
		assert.ok(!TimeZone.of('Europe/Brussels').equals(TimeZone.of('Europe/Amsterdam')))
	})

	it('knows its offset and region', () => {
		assert.equal(TimeZone.of('Asia/Tehran').offsetAt(summer), 210)
		assert.equal(TimeZone.of('America/Los_Angeles').offsetAt(summer), -420)
		assert.equal(TimeZone.of('Europe/London').region, 'GB')
		assert.equal(TimeZone.of('Asia/Calcutta').region, 'IN')
	})

	it('tells a zone that keeps daylight saving from one that does not, in either hemisphere', () => {
		const offsets = (id: string) => TimeZone.of(id).yearlyOffsets
		assert.deepEqual(offsets('Europe/Berlin'), [60, 120])
		assert.deepEqual(offsets('Africa/Algiers'), [60, 60])
		assert.deepEqual(offsets('Australia/Sydney'), [660, 600])
		assert.deepEqual(offsets('Asia/Tehran'), [210, 210])
	})

	it('knows the zones Unicode names a time after, worldwide and per country, in either spelling', () => {
		assert.ok(TimeZone.of('America/New_York').isGoldenIn())
		assert.ok(!TimeZone.of('America/Toronto').isGoldenIn())
		assert.ok(TimeZone.of('America/Toronto').isGoldenIn('CA'))
		assert.ok(TimeZone.of('Europe/Berlin').isGoldenIn('DE'))
		assert.ok(TimeZone.of('Asia/Calcutta').isGoldenIn())
	})

	it('is written as its id', () => {
		assert.equal(JSON.stringify({ zone: TimeZone.of('Asia/Tokyo') }), '{"zone":"Asia/Tokyo"}')
		assert.equal(`${TimeZone.of('Asia/Tokyo')}`, 'Asia/Tokyo')
	})
})
