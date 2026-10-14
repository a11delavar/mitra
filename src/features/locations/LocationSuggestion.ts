/** Photon's GeoJSON feature, of which only the OpenStreetMap properties are read. */
export interface PhotonFeature {
	properties?: Record<string, unknown>
}

/** A place the location field offers: one the user has used before, or one Photon found. */
export class LocationSuggestion {
	/** The OpenStreetMap keys whose value names a kind of place ("restaurant") rather than a road or a boundary. */
	private static readonly placeKeys = new Set(['amenity', 'shop', 'leisure', 'tourism', 'office', 'craft', 'historic', 'sport', 'railway', 'aeroway', 'healthcare'])

	private static readonly icons: Record<string, string> = {
		restaurant: 'utensils', food_court: 'utensils', fast_food: 'hamburger',
		cafe: 'coffee', bar: 'beer', pub: 'beer', biergarten: 'beer',
		hotel: 'bed', hostel: 'bed', guest_house: 'bed', motel: 'bed', camp_site: 'tent',
		supermarket: 'shopping-cart', mall: 'store', department_store: 'store', convenience: 'store',
		museum: 'landmark', gallery: 'landmark', attraction: 'landmark', memorial: 'landmark', monument: 'landmark', castle: 'landmark',
		station: 'train-front', halt: 'train-front', tram_stop: 'train-front', aerodrome: 'plane',
		hospital: 'hospital', clinic: 'hospital', doctors: 'hospital', pharmacy: 'hospital',
		school: 'graduation-cap', university: 'graduation-cap', college: 'graduation-cap', library: 'library',
		cinema: 'clapperboard', theatre: 'theater',
		park: 'trees', garden: 'trees', playground: 'trees', nature_reserve: 'trees',
		sports_centre: 'dumbbell', fitness_centre: 'dumbbell', stadium: 'dumbbell', pitch: 'dumbbell',
		place_of_worship: 'church', bank: 'banknote',
	}

	/** A location the user wrote before, split at its first comma into a name and the rest. */
	static recent(location: string) {
		const [name = location, ...rest] = location.split(', ')
		return new LocationSuggestion({ name, detail: rest.join(', '), recent: true })
	}

	/** Photon's features as places, each named once: by its name or else its street, detailed by where it lies. */
	static fromPhoton(features: ReadonlyArray<PhotonFeature>): Array<LocationSuggestion> {
		const places = new Map<string, LocationSuggestion>()
		for (const { properties = {} } of features) {
			const text = (key: string) => typeof properties[key] === 'string' ? properties[key] as string : undefined
			const street = [text('street'), text('housenumber')].filter(Boolean).join(' ')
			const name = text('name') || street
			if (!name) {
				continue
			}
			const detail = [street, text('district'), text('city'), text('state'), text('country')]
				.filter((part): part is string => !!part && part !== name)
				.filter((part, index, parts) => parts.indexOf(part) === index)
				.join(', ')
			const place = new LocationSuggestion({ name, detail, type: LocationSuggestion.kindOf(properties) })
			if (!places.has(place.location)) {
				places.set(place.location, place)
			}
		}
		return [...places.values()]
	}

	private static kindOf(properties: Record<string, unknown>): string | undefined {
		const { osm_key: key, osm_value: value } = properties
		return typeof key === 'string' && typeof value === 'string' && LocationSuggestion.placeKeys.has(key) && value !== 'yes' ? value : undefined
	}

	name = ''
	detail = ''
	/** The OpenStreetMap kind of place (`fast_food`). */
	type?: string
	recent?: boolean

	constructor(init?: Partial<LocationSuggestion>) {
		Object.assign(this, init)
	}

	/** "Name, detail": what the location field holds once it is picked. */
	get location() {
		return this.detail ? `${this.name}, ${this.detail}` : this.name
	}

	get icon() {
		return this.recent ? 'history' : LocationSuggestion.icons[this.type ?? ''] ?? 'map-pin'
	}

	/** Its kind as OpenStreetMap names it, in words ("Fast Food"). */
	get kind() {
		return this.type?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
	}
}
