import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LocationSuggestion } from './LocationSuggestion.js'

const feature = (properties: Record<string, unknown>) => ({ properties })
const facts = (places: ReadonlyArray<LocationSuggestion>) => places.map(({ name, detail, type }) => ({ name, detail, type }))

describe('LocationSuggestion', () => {
	describe('fromPhoton', () => {
		it('names a place by its name, else its street, detailed by where it lies without repeating itself', () => {
			const places = LocationSuggestion.fromPhoton([
				feature({ name: 'Café Luna', street: 'Main Street', housenumber: '4', city: 'Springfield', state: 'Springfield', country: 'Freedonia', osm_key: 'amenity', osm_value: 'cafe' }),
				feature({ street: 'Elm Road', housenumber: '12', district: 'Old Town', city: 'Shelbyville' }),
				feature({ city: 'Nowhere' }),
				feature({}),
			])
			assert.deepEqual(facts(places), [
				{ name: 'Café Luna', detail: 'Main Street 4, Springfield, Freedonia', type: 'cafe' },
				{ name: 'Elm Road 12', detail: 'Old Town, Shelbyville', type: undefined },
			])
		})

		it('lists a place once, however often Photon finds it', () => {
			const twice = feature({ name: 'Station', city: 'Springfield', osm_key: 'railway', osm_value: 'station' })
			assert.equal(LocationSuggestion.fromPhoton([twice, twice]).length, 1)
		})

		it('keeps a kind only where OpenStreetMap names a kind of place', () => {
			const kind = (osm_key: string, osm_value: string) => LocationSuggestion.fromPhoton([feature({ name: 'Somewhere', osm_key, osm_value })])[0]!.type
			assert.equal(kind('shop', 'supermarket'), 'supermarket')
			assert.equal(kind('highway', 'residential'), undefined)
			assert.equal(kind('amenity', 'yes'), undefined)
		})
	})

	it('reads a recent location as a name and the rest of its address', () => {
		const recent = LocationSuggestion.recent('Gym, Park Road 3, Springfield')
		assert.deepEqual({ ...recent }, { name: 'Gym', detail: 'Park Road 3, Springfield', recent: true })
		assert.equal(recent.location, 'Gym, Park Road 3, Springfield')
		assert.equal(LocationSuggestion.recent('Studio').location, 'Studio')
	})

	it('shows a recent place by its history, a known kind by its icon, anything else by a pin', () => {
		assert.equal(LocationSuggestion.recent('Café Luna').icon, 'history')
		assert.equal(new LocationSuggestion({ name: 'Café Luna', type: 'cafe' }).icon, 'coffee')
		assert.equal(new LocationSuggestion({ name: 'Somewhere', type: 'quarry' }).icon, 'map-pin')
		assert.equal(new LocationSuggestion({ name: 'Somewhere' }).icon, 'map-pin')
	})

	it('words its kind', () => {
		assert.equal(new LocationSuggestion({ type: 'fast_food' }).kind, 'Fast Food')
		assert.equal(new LocationSuggestion().kind, undefined)
	})
})
