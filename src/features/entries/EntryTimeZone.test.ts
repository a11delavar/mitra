import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TimeZone } from '#features/time/TimeZone.js'
import { EntryTimeZone } from './EntryTimeZone.js'

describe('EntryTimeZone', () => {
	it('reads a zone by its id, keeping the spelling it was written with', () => {
		const kolkata = EntryTimeZone.parse('Asia/Kolkata')!
		assert.equal(kolkata.id, 'Asia/Kolkata')
		assert.equal(EntryTimeZone.parse('Asia/Calcutta')!.id, 'Asia/Calcutta')
		assert.ok(kolkata.zone!.equals(TimeZone.of('Asia/Calcutta')))
		assert.equal(EntryTimeZone.parse(kolkata), kolkata)
		assert.equal(EntryTimeZone.of(TimeZone.of('Europe/Berlin')).id, TimeZone.of('Europe/Berlin').id)
	})

	it('reads floating as the one floating clock, and anything else as none', () => {
		assert.equal(EntryTimeZone.parse('floating'), EntryTimeZone.floating)
		assert.equal(EntryTimeZone.parse('W. Europe Standard Time'), undefined)
		assert.equal(EntryTimeZone.parse(''), undefined)
		assert.equal(EntryTimeZone.parse(null), undefined)
		assert.equal(EntryTimeZone.parse(7), undefined)
	})

	it('reads the wall clock in its zone, a floating one as if in UTC', () => {
		assert.equal(EntryTimeZone.floating.floating, true)
		assert.equal(EntryTimeZone.floating.zone, undefined)
		assert.equal(EntryTimeZone.floating.clock, 'UTC')
		const tehran = EntryTimeZone.parse('Asia/Tehran')!
		assert.equal(tehran.floating, false)
		assert.equal(tehran.clock, 'Asia/Tehran')
	})

	it('is the same clock whichever spelling each was written with, and floating only as floating', () => {
		assert.ok(EntryTimeZone.parse('Asia/Kolkata')!.equals(EntryTimeZone.parse('Asia/Calcutta')))
		assert.ok(!EntryTimeZone.parse('Europe/Berlin')!.equals(EntryTimeZone.parse('Europe/Oslo')))
		assert.ok(EntryTimeZone.floating.equals(EntryTimeZone.parse('floating')))
		assert.ok(!EntryTimeZone.floating.equals(EntryTimeZone.parse('UTC')))
		assert.ok(!EntryTimeZone.parse('UTC')!.equals(EntryTimeZone.floating))
		assert.ok(!EntryTimeZone.parse('UTC')!.equals(null))
	})

	it('crosses the wire and the column as its id, an unknown one as none', () => {
		const { converter } = EntryTimeZone
		const mapper = new EntryTimeZone.Mapper()
		assert.equal(converter.deconstruct!(EntryTimeZone.parse('Asia/Kolkata'), {}), 'Asia/Kolkata')
		assert.equal(converter.deconstruct!(null, {}), null)
		assert.equal(converter.construct!('floating', {}), EntryTimeZone.floating)
		assert.equal(converter.construct!('Mars/Olympus', {}), null)
		assert.equal(converter.construct!(null, {}), null)
		assert.equal(converter.construct!(undefined, {}), undefined)
		assert.equal(mapper.convertToDatabaseValue(EntryTimeZone.parse('Asia/Kolkata')), 'Asia/Kolkata')
		assert.equal(mapper.convertToJSValue('W. Europe Standard Time'), null)
		assert.equal(mapper.convertToJSValue(null), null)
	})
})
