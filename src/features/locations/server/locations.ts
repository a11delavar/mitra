import { Router } from 'express'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { orm } from '../../../infrastructure/database/orm.js'
import { LocationSuggestion, type PhotonFeature } from '../LocationSuggestion.js'
import { recentLocations } from './recentLocations.js'

const logger = createLogger('Locations')

/**
 * Location autocomplete endpoint: returns recent locations from SQLite and Photon geocoded suggestions.
 */
const PHOTON_URL = process.env.MITRA_PHOTON_URL || 'https://photon.komoot.io'

const PHOTON_LANGUAGES = new Set(['en', 'de', 'fr'])

export const locationsRouter = Router()

locationsRouter.get('/', async (req, res) => {
	const { q, lang, lat, lon } = req.query as { q?: string, lang?: string, lat?: string, lon?: string }
	const query = q?.trim() ?? ''

	const em = orm.em.fork()
	const recents = await recentLocations(em, (await req.user.sources(em)).map(source => source.id), query)
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
		const seen = new Set(recents.map(recent => recent.location))
		const geocoded = LocationSuggestion.fromPhoton(body.features ?? []).filter(suggestion => !seen.has(suggestion.location))
		logger.debug(`Geocoded "${query}" via Photon → ${geocoded.length} suggestion(s) (+${recents.length} recent)`)
		return res.json([...recents, ...geocoded])
	} catch (error) {
		logger.warn('Lookup failed:', error instanceof Error ? error.message : error)
		return res.json(recents)
	}
})
