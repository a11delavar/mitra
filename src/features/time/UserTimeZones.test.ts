import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { User } from '#features/identity'
import { revive, wireOf } from '#infrastructure/model/wire.testing.js'
import { TimeZone } from './TimeZone.js'
import { UserTimeZones } from './UserTimeZones.js'

const BERLIN = TimeZone.of('Europe/Berlin'), LONDON = TimeZone.of('Europe/London'), TOKYO = TimeZone.of('Asia/Tokyo')
const ids = (zones: ReadonlyArray<{ readonly zone: TimeZone }>) => zones.map(({ zone }) => zone.id)
const none = UserTimeZones.none

describe('UserTimeZones', () => {
	it('settles home in the first zone a device runs in, and only once', () => {
		const settled = none.settle(BERLIN)
		assert.equal(settled.home?.zone, BERLIN)
		assert.equal(settled.settle(LONDON), settled)
	})

	it('shows home beside a trip without storing the trip', () => {
		const zones = none.settle(BERLIN)
		assert.deepEqual(ids(zones.besides(LONDON)), ['Europe/Berlin'])
		assert.deepEqual(ids(zones.besides(BERLIN)), [])
		assert.deepEqual(zones.toJSON(), { home: { id: 'Europe/Berlin' }, others: [] })
	})

	it('keeps an added zone the device travels to as a column, never twice', () => {
		const zones = none.settle(BERLIN).add(LONDON)
		assert.deepEqual(ids(zones.besides(LONDON)), ['Europe/Berlin'])
		assert.deepEqual(ids(zones.besides(BERLIN)), ['Europe/London'])
		assert.equal(zones.add(LONDON), zones)
	})

	it('makes a zone home, keeping the old home where the new one was', () => {
		const zones = none.settle(BERLIN).add(TOKYO).add(LONDON).rename(LONDON, 'Office').makeHome(LONDON)
		assert.deepEqual(zones.toJSON(), { home: { id: 'Europe/London', label: 'Office' }, others: [{ id: 'Asia/Tokyo' }, { id: 'Europe/Berlin' }] })
		assert.deepEqual(ids(none.settle(BERLIN).makeHome(TOKYO).others), ['Europe/Berlin'])
	})

	it('removes added zones but never home', () => {
		const zones = none.settle(BERLIN).add(TOKYO)
		assert.deepEqual(ids(zones.remove(TOKYO).zones), ['Europe/Berlin'])
		assert.deepEqual(ids(zones.remove(BERLIN).zones), ['Europe/Berlin', 'Asia/Tokyo'])
	})

	it('keeps a zone the user names, and trims the name to its length', () => {
		const zones = none.settle(BERLIN).rename(TOKYO, '  A name far longer than any column could hold  ')
		assert.deepEqual(zones.toJSON().others, [{ id: 'Asia/Tokyo', label: 'A name far longer than a' }])
		assert.equal(zones.rename(TOKYO, ' ').labelOf(TOKYO), undefined)
		assert.equal(zones.rename(BERLIN, 'Home').home?.label, 'Home')
		// A trip's zone left unnamed stays the device's, never the account's.
		assert.deepEqual(none.settle(BERLIN).rename(TOKYO, '').toJSON().others, [])
	})

	it('reads the plain list stored before home, dropping unknown and repeated zones', () => {
		const zones = UserTimeZones.parse([{ id: 'Asia/Tokyo', label: 'JP' }, { id: 'Mars/Olympus' }, { id: 'Asia/Tokyo' }, { id: 'Europe/London', automatic: true }])
		assert.equal(zones.home, undefined)
		assert.deepEqual(zones.toJSON(), { others: [{ id: 'Asia/Tokyo', label: 'JP' }, { id: 'Europe/London' }] })
		assert.deepEqual(zones.settle(TOKYO).toJSON(), { home: { id: 'Asia/Tokyo', label: 'JP' }, others: [{ id: 'Europe/London' }] })
	})

	it('matches a zone by any of its names', () => {
		const zones = none.settle(TimeZone.of('Asia/Calcutta'))
		assert.equal(zones.isHome(TimeZone.of('Asia/Kolkata')), true)
		assert.deepEqual(ids(zones.besides(TimeZone.of('Asia/Kolkata'))), [])
	})

	it('heads a column with the name the user gave the zone, else its short name', () => {
		const locale = new Intl.Locale('en-US')
		const zones = none.settle(BERLIN).rename(TOKYO, 'JP')
		assert.equal(zones.headingOf(TOKYO, locale), 'JP')
		assert.equal(zones.headingOf(BERLIN, locale), BERLIN.name(locale).short)
	})

	it('saves itself and reads itself back, from the database and from the wire', () => {
		const zones = none.settle(BERLIN).add(TOKYO).rename(TOKYO, 'JP')
		const mapper = new UserTimeZones.Mapper()
		const stored = mapper.convertToDatabaseValue(zones)
		assert.equal(stored, '{"home":{"id":"Europe/Berlin"},"others":[{"id":"Asia/Tokyo","label":"JP"}]}')
		assert.deepEqual(mapper.convertToJSValue(stored).toJSON(), zones.toJSON())
		assert.deepEqual(mapper.convertToJSValue(JSON.parse(stored)).toJSON(), zones.toJSON())
		const wire = wireOf(new User({ username: 'me', timeZones: zones }))
		assert.deepEqual(wire.timeZones, zones.toJSON())
		assert.deepEqual(revive<User>(wire).timeZones!.toJSON(), zones.toJSON())
		assert.deepEqual(revive<User>({ ...wire, timeZones: null }).timeZones!.zones, [])
	})
})
