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
		assert.equal(TimeZone.parse(TimeZone.of('Asia/Tokyo')), TimeZone.of('Asia/Tokyo'))
	})

	it('keeps a zone in its column as its id, and reads it back as the zone', () => {
		const mapper = new TimeZone.Mapper()
		assert.equal(mapper.convertToDatabaseValue(TimeZone.of('Asia/Tokyo')), 'Asia/Tokyo')
		assert.equal(mapper.convertToJSValue('Asia/Tokyo'), TimeZone.of('Asia/Tokyo'))
		assert.equal(mapper.convertToDatabaseValue(undefined), null)
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

	it('shifts an instant by the wall-clock distance, keeping 09:00 at 09:00 across a DST change', () => {
		const berlin = TimeZone.of('Europe/Berlin')
		// A Friday 09:00 CEST occurrence moved to the Sunday: two wall days, the anchor two weeks before it.
		const shifted = berlin.shift(new Date('2026-10-09T07:00:00Z'), new Date('2026-10-23T07:00:00Z'), new Date('2026-10-25T08:00:00Z'))
		assert.equal(shifted.toISOString(), '2026-10-11T07:00:00.000Z')
		// Across the change itself: 09:00 CEST to 09:00 CET is one wall week but 7 days and an hour.
		assert.equal(berlin.shift(new Date('2026-10-23T07:00:00Z'), new Date('2026-10-23T07:00:00Z'), new Date('2026-10-30T08:00:00Z')).toISOString(), '2026-10-30T08:00:00.000Z')
	})

	// An all-day entry's days are UTC midnights read back in a viewer's zone, so the two must be exact inverses in every zone.
	describe('days', () => {
		const jun2 = Temporal.PlainDate.from('2026-06-02')

		it('begins a day at its midnight in the zone', () => {
			assert.equal(TimeZone.UTC.midnightOf(jun2).toISOString(), '2026-06-02T00:00:00.000Z')
			assert.equal(TimeZone.of('Europe/Berlin').midnightOf(jun2).toISOString(), '2026-06-01T22:00:00.000Z')
			assert.equal(TimeZone.of('Asia/Tehran').midnightOf(jun2).toISOString(), '2026-06-01T20:30:00.000Z')
			assert.equal(TimeZone.of('America/New_York').midnightOf(jun2).toISOString(), '2026-06-02T04:00:00.000Z')
			assert.equal(TimeZone.of('Pacific/Kiritimati').midnightOf(jun2).toISOString(), '2026-06-01T10:00:00.000Z')
			assert.equal(TimeZone.of('Europe/Berlin').midnightOf(Temporal.PlainDate.from('2026-01-15')).toISOString(), '2026-01-14T23:00:00.000Z')
		})

		it('reads a midnight back as its day, everywhere', () => {
			for (const id of ['Europe/Berlin', 'Asia/Tehran', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'UTC']) {
				const zone = TimeZone.of(id)
				const midnight = zone.midnightOf(jun2)
				assert.ok(zone.dayOf(midnight).equals(jun2), id)
				assert.equal(TimeZone.UTC.midnightOf(zone.dayOf(midnight)).toISOString(), '2026-06-02T00:00:00.000Z', id)
			}
		})

		it('reads an instant as the day it falls on there', () => {
			assert.equal(TimeZone.of('Europe/Berlin').dayOf(new Date('2026-07-11T22:30:00Z')).toString(), '2026-07-12')
			assert.equal(TimeZone.UTC.dayOf(new Date('2026-07-11T22:30:00Z')).toString(), '2026-07-11')
		})

		it('begins a day whose midnight a DST jump skips at its first wall-clock time', () => {
			// Santiago springs forward at midnight: Sep 6 2026 begins at 01:00 local.
			const santiago = TimeZone.of('America/Santiago')
			assert.equal(santiago.dayOf(santiago.midnightOf(Temporal.PlainDate.from('2026-09-06'))).toString(), '2026-09-06')
		})
	})
})
