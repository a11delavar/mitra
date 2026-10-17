import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { LocationSuggestion, type PhotonFeature } from '../LocationSuggestion.js'
import { recentLocations } from './recentLocations.js'

const PHOTON_URL = process.env.MITRA_PHOTON_URL || 'https://photon.komoot.io'

const PHOTON_LANGUAGES = new Set(['en', 'de', 'fr'])

@operation()
@label('Suggest locations')
@description('Suggests locations for what has been typed: the user\'s recent ones, then places Photon finds, near the position given.')
@http({ method: 'GET', path: '/locations' })
export class SuggestLocations extends Operation<{ readonly q?: string, readonly lang?: string, readonly lat?: string, readonly lon?: string }, Array<LocationSuggestion>> {
	async run({ em, user }: OperationContext): Promise<Array<LocationSuggestion>> {
		const { q, lang, lat, lon } = this.parameters
		const query = q?.trim() ?? ''

		const recents = await recentLocations(em, (await user.sources(em)).map(source => source.id), query)
		if (query.length < 2) {
			return recents
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
			this.logger.debug(`Geocoded "${query}" via Photon → ${geocoded.length} suggestion(s) (+${recents.length} recent)`)
			return [...recents, ...geocoded]
		} catch (error) {
			this.logger.warn('Lookup failed:', error instanceof Error ? error.message : error)
			return recents
		}
	}
}
