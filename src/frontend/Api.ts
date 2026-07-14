import { Api, HttpError, apiError, apiAuthenticator, type ApiAuthenticator } from '@a11d/api'
import { type DateTime } from '@3mo/date-time'
import type { Entry, Integration, RecurrenceScope, Source, User, UserTimeZone } from 'shared'

/**
 * Surface the server's error message on failed responses. Without a registered
 * constructor, `@a11d/api` falls back to `new Error(await response.json())`, which
 * stringifies the JSON body to "[object Object]". The backend always replies with
 * `{ error: string }`, so lift that into the thrown `Error`'s message.
 */
@apiError()
export class ApiError extends HttpError {
	get status() {
		return this.response.status
	}

	override async throw(): Promise<never> {
		// The session expired mid-use (multi-user mode): bounce through the backend's sign-in and land
		// back here. Initial navigations never reach this — the server redirects the app shell itself.
		if (this.status === 401) {
			location.assign(`/auth/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)
		}
		const body = await this.response.json().catch(() => undefined) as { error?: string } | undefined
		this.message = body?.error || this.response.statusText || `Request failed (${this.response.status})`
		throw this
	}
}

/**
 * Send the session cookie with every API request. `@a11d/api` defaults to `credentials: 'omit'`, which is
 * fine for a single-user deployment but breaks behind a cookie-based auth proxy (e.g. Traefik OIDC): the
 * cookie-less `/api` call reads as unauthenticated, the proxy 302-redirects to the IdP, and the browser
 * following that cross-origin redirect trips CORS. Including credentials sends the proxy's session cookie,
 * so the same-origin `/api` request authenticates normally. (App-level auth is the proxy's concern, so the
 * token methods are no-ops.)
 */
@apiAuthenticator()
export class CookieAuthenticator implements ApiAuthenticator {
	authenticate() { }
	unauthenticate() { }
	isAuthenticated() { return true }
	processRequest(request: RequestInit) {
		request.credentials = 'include'
		return request
	}
}

let integrations = new Array<Integration>()
let currentUser: User | undefined

/** The browser's IANA zone, sent as `?tz=` with every entry read/write: the backend stores all-day
 * bounds as zone-less calendar dates and projects them into THIS zone, so all-day entries cover the
 * same dates — midnight to midnight — wherever the server runs and whoever is looking. */
const tz = () => encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)

export async function fetchUser() {
	return currentUser = await Api.get<User>('/user')
}

/** The signed-in user. An `identity` marks OIDC (multi-user mode) — that's what the sidebar keys the
 * account section and sign-out on; the single-user default has none. */
export function getUser() {
	return currentUser
}

export function getDefaultSourceId() {
	return currentUser?.defaultSourceId
}

export async function setDefaultSource(sourceId: string | undefined) {
	return currentUser = await Api.put<User>('/user/default-source', { sourceId: sourceId ?? null })
}

/** The user's ADDITIONAL display time zones (the system zone is implicit — it anchors the grid). */
export function getTimeZones(): Array<UserTimeZone> {
	return currentUser?.timeZones ?? []
}

export async function setTimeZones(timeZones: Array<UserTimeZone>) {
	return currentUser = await Api.put<User>('/user/time-zones', { timeZones })
}

export function fetchEvents(start: DateTime, end: DateTime) {
	return Api.get<Array<Entry>>(`/entries?start=${start.toISOString()}&end=${end.toISOString()}&tz=${tz()}`)
}

/** Text search over the WHOLE entry store (heading/description/location, every visible source) —
 * the command palette's data source; unwindowed, unlike {@link fetchEvents}. */
export function searchEntries(query: string) {
	return Api.get<Array<Entry>>(`/entries/search?q=${encodeURIComponent(query)}&tz=${tz()}`)
}

/** The source a create targets: the user's default when visible, else the first visible one. */
export function getPrimarySource(): Source | undefined {
	const visibleSources = integrations.flatMap(i => [...i.sources]).filter(s => s.visible)
	return visibleSources.find(s => s.id === getDefaultSourceId()) ?? visibleSources[0]
}

export function createEvent(entry: Entry) {
	// Stamp the zone the times were authored in — recurrence must expand at THIS zone's wall clock
	// ("every Monday 09:00 Berlin" survives DST), and the future zone selector edits this field.
	return Api.post<Entry>(`/entries?tz=${tz()}`, { ...entry, timeZone: entry.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone })
}

export async function fetchIntegrations() {
	return integrations = await Api.get<Array<Integration>>('/integrations')
}

export function getIntegrations() {
	return [...integrations]
}

export function getSource(id: string) {
	return integrations.flatMap(i => [...i.sources]).find(s => s.id === id)
}

export function getIntegrationFor(sourceId: string) {
	return integrations.find(i => [...i.sources].some(s => s.id === sourceId))
}

/**
 * What the provider behind a source can represent (see Integration.capabilities) — what the editor
 * keys hiding unsupported fields on. Defaults to everything: a provider the client doesn't model
 * (e.g. the backend-only Dev integration) arrives as a plain DTO without the getter, and full
 * capability is the right reading for it.
 */
export function getCapabilities(sourceId: string): Integration['capabilities'] {
	return getIntegrationFor(sourceId)?.capabilities
		?? { recurrence: true, reminders: true, location: true, description: true, cancelledStatus: true, timeZone: true }
}

export function toggleSourceVisibility(id: string, hidden: boolean) {
	return Api.put(`/sources/${id}/visibility`, { hidden })
}

export function updateSourceColor(id: string, color: string) {
	return Api.put(`/sources/${id}/color`, { color })
}

export function renameSource(id: string, name: string) {
	return Api.put<Source>(`/sources/${id}/name`, { name })
}

export function resyncSource(id: string) {
	return Api.post(`/sources/${id}/resync`)
}

export function resyncIntegration(id: string) {
	return Api.post(`/integrations/${id}/resync`)
}

export function discoverSources(integration: Integration) {
	return Api.post<Array<Source>>('/integrations/sources', integration)
}

/** Whether this deployment can connect Google accounts (MITRA_GOOGLE_CLIENT_ID configured). */
export function fetchGoogleAvailability() {
	return Api.get<{ configured: boolean }>('/integrations/google')
}

/** Starts the Google consent flow — a full-page navigation: Google redirects back into the app with
 * the new integration's source picker open (see Mitra.openPendingIntegration). */
export function connectGoogle() {
	location.assign('/api/integrations/google/connect')
}

export function createIntegration(integration: Integration) {
	return Api.post<Integration>('/integrations', integration)
}

export function updateIntegration(integration: Integration) {
	return Api.put<Integration>(`/integrations/${integration.id}`, integration)
}

export function deleteIntegration(id: string) {
	return Api.delete(`/integrations/${id}`)
}

export function updateEvent(entry: Entry) {
	// A series occurrence (or synced override) has no row of its own: its edit applies series-wide via
	// the MASTER, sending only the series-wide content fields so the master keeps its own schedule.
	// `recurrence` rides along only when the occurrence actually carries a value — an object (possibly
	// edited via the Repeat field) or an explicit `null` (remove the rule). A synced override row has
	// none of its own, and omitting the field there keeps a benign rename from wiping the master's rule.
	if (entry.recurrenceMasterId) {
		return Api.put<Entry>(`/entries/${entry.recurrenceMasterId}?tz=${tz()}`, {
			heading: entry.heading,
			description: entry.description,
			location: entry.location,
			color: entry.color,
			timeZone: entry.timeZone ?? null,
			reminders: entry.reminders ?? null,
			...(entry.recurrence !== undefined ? { recurrence: entry.recurrence } : {}),
		})
	}
	// The full entry, with absent tri-state fields sent as an explicit `null`: JSON drops undefined keys
	// and the backend treats absence as "keep" — only a null can express a removal.
	return Api.put<Entry>(`/entries/${entry.id}?tz=${tz()}`, { ...entry, recurrence: entry.recurrence ?? null, reminders: entry.reminders ?? null })
}

export function deleteEvent(id: string) {
	return Api.delete(`/entries/${id}`)
}

export interface LocationSuggestion {
	name: string
	detail: string
	/** The kind of place where the geocoder's OSM tag names one, as the raw tag value (`restaurant`,
	 * `fast_food`, …). Display-only disambiguation for ambiguous names — the frontend owns turning it
	 * into a (localizable) label and an icon; never part of the committed location string. */
	type?: string
	/** A recently used location from the user's own entries, listed before the geocoder's results. */
	recent?: boolean
}

/** Location autocomplete via the backend's geocoder proxy (see backend/locations.ts). The UI language
 * rides along so results are labelled in it where the geocoder supports it; the user's position (when
 * granted) biases the geocoder towards nearby places. */
export function searchLocations(query: string, position?: { lat: number, lon: number }) {
	const params = new URLSearchParams({ q: query, lang: navigator.language.split('-')[0] ?? 'en' })
	if (position) {
		params.set('lat', String(position.lat))
		params.set('lon', String(position.lon))
	}
	return Api.get<Array<LocationSuggestion>>(`/locations?${params}`)
}

/** Apply an occurrence's edited fields to its series with a scope (this / following / all). Targets the
 * MASTER; `recurrenceId` names the occurrence being edited. The response is the resulting entry: the
 * master ('all'), the continuation series' master ('following'), or the detached standalone ('this'). */
export function editOccurrence(occurrence: Entry, scope: RecurrenceScope) {
	return Api.put<Entry>(`/entries/${occurrence.recurrenceMasterId}?tz=${tz()}`, {
		scope,
		recurrenceId: occurrence.recurrenceId,
		heading: occurrence.heading,
		description: occurrence.description,
		location: occurrence.location,
		color: occurrence.color,
		start: occurrence.start,
		end: occurrence.end,
		allDay: occurrence.allDay,
		timeZone: occurrence.timeZone ?? null,
		status: occurrence.status,
		reminders: occurrence.reminders ?? null,
	})
}

/** Delete an occurrence from its series with a scope (this / following) — DELETE carries no body, so
 * the scope + occurrence start go as query params. ('all' deletes the master via deleteEvent.) */
export function deleteOccurrence(occurrence: Entry, scope: RecurrenceScope) {
	const query = new URLSearchParams({ scope, recurrenceId: occurrence.recurrenceId!.toISOString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
	return Api.delete(`/entries/${occurrence.recurrenceMasterId}?${query}`)
}
