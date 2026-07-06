import { Router } from 'express'
import { createLogger } from '../shared/index.js'
import { orm } from './orm.js'

const logger = createLogger('Locations')

/**
 * Location autocomplete for the entry editor: recently used locations from the user's own entries
 * first, then geocoder suggestions proxying Photon (photon.komoot.io) — the open-source, OSM-based
 * geocoder built specifically for search-as-you-type: free, keyless, typo-tolerant, and self-hostable.
 * Proxied rather than queried from the browser so location keystrokes leave through this server only
 * (one well-behaved client of komoot's fair-use public instance, no user IPs), and so a self-hosted
 * Photon can be swapped in via `MITRA_PHOTON_URL` without touching the frontend.
 *
 * The result is presentation data, not a model: the entry's `location` stays a plain string (RFC 5545
 * LOCATION is TEXT) — a picked suggestion merely fills in a nicely formatted one.
 */
const PHOTON_URL = process.env.MITRA_PHOTON_URL || 'https://photon.komoot.io'

// Photon rejects a `lang` it doesn't support with a 400, so only a known one is forwarded;
// anything else falls back to Photon's default (each place's local name).
const PHOTON_LANGUAGES = new Set(['en', 'de', 'fr'])

interface PhotonFeature {
	properties?: Record<string, unknown>
}

interface LocationSuggestion {
	name: string
	detail: string
	type?: string
	recent?: boolean
}

export const locationsRouter = Router()

locationsRouter.get('/', async (req, res) => {
	const { q, lang, lat, lon } = req.query as { q?: string, lang?: string, lat?: string, lon?: string }
	const query = q?.trim() ?? ''

	// Recently used locations lead the list — an empty/short query (the field was just focused) shows
	// them alone, Notion-style; once typing, they narrow along with the geocoder's results.
	const recents = await recentLocations(query)
	if (query.length < 2) {
		return res.json(recents)
	}

	const url = new URL('/api', PHOTON_URL)
	url.searchParams.set('q', query)
	url.searchParams.set('limit', '6')
	if (lang && PHOTON_LANGUAGES.has(lang)) {
		url.searchParams.set('lang', lang)
	}
	// Bias results towards the user's position (Photon sorts by a relevance/proximity blend) — nearby
	// places first without discarding the exact-name matches elsewhere. City-level zoom: Photon's
	// default is street-level, too aggressive for "places I might put on a calendar".
	if (lat && lon && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
		url.searchParams.set('lat', lat)
		url.searchParams.set('lon', lon)
		url.searchParams.set('zoom', '12')
	}

	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
		if (!response.ok) {
			throw new Error(`${response.status} ${response.statusText}`)
		}
		const body = await response.json() as { features?: Array<PhotonFeature> }
		const seen = new Set(recents.map(full))
		return res.json([...recents, ...suggestions(body.features ?? []).filter(suggestion => !seen.has(full(suggestion)))])
	} catch (error) {
		// Degrade to what we have: recents (and free text) beat a broken location field — the value the
		// user is typing is valid as-is either way.
		logger.warn('Lookup failed:', error instanceof Error ? error.message : error)
		return res.json(recents)
	}
})

/** The composed string a picked suggestion writes into the entry — also the dedupe key between a
 * recent (which IS such a string, split back apart) and a fresh geocoder result. */
function full(suggestion: LocationSuggestion): string {
	return suggestion.detail ? `${suggestion.name}, ${suggestion.detail}` : suggestion.name
}

/** The most recently used distinct locations across the user's entries (by their latest occurrence),
 * optionally narrowed by the typed query. */
async function recentLocations(query: string): Promise<Array<LocationSuggestion>> {
	const em = orm.em.fork()
	const escaped = query.replace(/[\\%_]/g, match => `\\${match}`)
	const rows = await em.getConnection().execute(
		'select location from entry where location <> \'\' and location like \'%\' || ? || \'%\' escape \'\\\' group by location order by max(start) desc limit 4',
		[escaped],
	) as Array<{ location: string }>
	return rows.map(row => {
		// Recents are stored as one flat string; picked suggestions compose it as "name, detail", so
		// splitting on the first comma recovers the two display lines.
		const [name = row.location, ...rest] = row.location.split(', ')
		return { name, detail: rest.join(', '), recent: true }
	})
}

// The OSM tag families whose value names a *kind* of place worth showing next to an ambiguous name
// ("Teheran · Restaurant" vs the city). Streets (highway), places (city/village) and areas are left
// out — there the address trail already says what it is.
const TYPE_KEYS = new Set(['amenity', 'shop', 'leisure', 'tourism', 'office', 'craft', 'historic', 'sport', 'railway', 'aeroway', 'healthcare'])

/** The kind of place off the feature's OSM tag, as the RAW tag value (`restaurant`, `fast_food`, …) —
 * a machine name, deliberately: the frontend owns its presentation (label wording/localization, icon). */
function placeType(properties: Record<string, unknown>): string | undefined {
	const key = properties.osm_key
	const value = properties.osm_value
	if (typeof key !== 'string' || typeof value !== 'string' || !TYPE_KEYS.has(key) || value === 'yes') {
		return undefined
	}
	return value
}

/** Flatten Photon's GeoJSON features into deduplicated `{ name, detail, type? }` items: the place's own
 * name (or its street address when it has none), a locating trail of the containing areas, and the kind
 * of place where the OSM tag names one. */
function suggestions(features: Array<PhotonFeature>): Array<LocationSuggestion> {
	const results = new Array<LocationSuggestion>()
	const seen = new Set<string>()
	for (const feature of features) {
		const properties = feature.properties ?? {}
		const text = (key: string) => typeof properties[key] === 'string' ? properties[key] as string : undefined
		const street = [text('street'), text('housenumber')].filter(Boolean).join(' ')
		const name = text('name') || street
		if (!name) {
			continue
		}
		const detail = [street, text('district'), text('city'), text('state'), text('country')]
			.filter((part): part is string => !!part && part !== name)
			.filter((part, index, parts) => parts.indexOf(part) === index) // city-states repeat (Berlin, Berlin)
			.join(', ')
		const key = `${name}|${detail}`
		if (!seen.has(key)) {
			seen.add(key)
			results.push({ name, detail, type: placeType(properties) })
		}
	}
	return results
}
