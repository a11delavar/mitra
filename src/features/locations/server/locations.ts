import { Router } from 'express'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { orm } from '../../../infrastructure/database/orm.js'

const logger = createLogger('Locations')

/**
 * Location autocomplete endpoint: returns recent locations from SQLite and Photon geocoded suggestions.
 */
const PHOTON_URL = process.env.MITRA_PHOTON_URL || 'https://photon.komoot.io'

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
		const geocoded = suggestions(body.features ?? []).filter(suggestion => !seen.has(full(suggestion)))
		logger.debug(`Geocoded "${query}" via Photon → ${geocoded.length} suggestion(s) (+${recents.length} recent)`)
		return res.json([...recents, ...geocoded])
	} catch (error) {
		logger.warn('Lookup failed:', error instanceof Error ? error.message : error)
		return res.json(recents)
	}
})

function full(suggestion: LocationSuggestion): string {
	return suggestion.detail ? `${suggestion.name}, ${suggestion.detail}` : suggestion.name
}

async function recentLocations(query: string): Promise<Array<LocationSuggestion>> {
	const em = orm.em.fork()
	const escaped = query.replace(/[\\%_]/g, match => `\\${match}`)
	const rows = await em.getConnection().execute(
		'select location from entry where location <> \'\' and location like \'%\' || ? || \'%\' escape \'\\\' group by location order by max(start) desc limit 4',
		[escaped],
	) as Array<{ location: string }>
	return rows.map(row => {
		const [name = row.location, ...rest] = row.location.split(', ')
		return { name, detail: rest.join(', '), recent: true }
	})
}

const TYPE_KEYS = new Set(['amenity', 'shop', 'leisure', 'tourism', 'office', 'craft', 'historic', 'sport', 'railway', 'aeroway', 'healthcare'])

function placeType(properties: Record<string, unknown>): string | undefined {
	const key = properties.osm_key
	const value = properties.osm_value
	if (typeof key !== 'string' || typeof value !== 'string' || !TYPE_KEYS.has(key) || value === 'yes') {
		return undefined
	}
	return value
}

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
			.filter((part, index, parts) => parts.indexOf(part) === index)
			.join(', ')
		const key = `${name}|${detail}`
		if (!seen.has(key)) {
			seen.add(key)
			results.push({ name, detail, type: placeType(properties) })
		}
	}
	return results
}
