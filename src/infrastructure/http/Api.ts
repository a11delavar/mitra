import { Api, HttpError, apiError, apiAuthenticator, type ApiAuthenticator } from '@a11d/api'
import { type DateTime } from '@3mo/date-time'
import { type User, type UserTimeZone } from '../../features/identity/User.js'
import { type Source } from '../../features/sources/Source.js'
import { type MigrationOutcome, type MigrationPlan } from '../../features/migration/MigrationPlan.js'
import { type Relation } from '../../features/relations/Relation.js'
import { type RecurrenceScope } from '../../features/recurrence/Recurrence.js'
import { applyOrder, byOrder } from '../model/order.js'
import { Integration } from '../../integrations/Integration.js'
import { type EntryType } from '../../features/entries/EntryType.js'
import { type Entry } from '../../features/entries/Entry.js'
import { type ChangelogSection } from '../../features/about/Changelog.js'

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

/** What the server says about itself (see features/about/server/meta.ts) — the brand row's name, the About
 * dialog's facts. A plain DTO, not a domain model. */
export interface InstanceMeta {
	/** The instance's display name — `MITRA_NAME`, defaulting to Mitra. */
	name: string
	/** The SERVER's version — normally the same string the frontend has baked in on `mitra.version`,
	 * differing only when a stale service-worker cache serves an older bundle. */
	version: string
	commit: string
	/** The server's Node.js runtime version. */
	node: string
	/** The running build's release page on GitHub — present only when the build is exactly a tag.
	 * Resolved server-side so the frontend links it without inspecting the version string. */
	releaseUrl?: string
	/** Present when the server's update checker (features/about/server/updates.ts) found something newer than the
	 * running build — a release tag, or for `:dev` images the state of main (`commits` then says how
	 * far ahead). `url` is where a human goes to read about it. */
	update?: { version: string, url: string, commits?: number }
}

let meta: InstanceMeta | undefined
let metaFetchedAt = 0

/** Matches the server's own check cadence — refreshing faster learns nothing new. */
const metaMaxAge = 6 * 60 * 60 * 1000

/** Fetched once at boot alongside the user; a failure costs the branding and About facts, never the app. */
export async function fetchMeta() {
	metaFetchedAt = Date.now()
	return meta = await Api.get<InstanceMeta>('/meta').catch(() => undefined)
}

/** A tab left open for days would never learn of an update from the boot-time fetch alone — callers
 * (the sidebar, on becoming visible) nudge this instead of running timers in hidden tabs. */
export async function refreshMetaIfStale() {
	if (Date.now() - metaFetchedAt > metaMaxAge) {
		await fetchMeta()
	}
	return meta
}

export function getMeta() {
	return meta
}

/** This tab runs an older bundle than the server — the server was updated underneath it, and a
 * plain reload IS the update. (The same mismatch DialogAbout papers over by preferring the server's
 * version for display.) */
export function isBundleStale() {
	return !!meta && meta.version !== mitra.version
}

/** What changed in the version you're RUNNING — readable offline; what an update would bring is the
 * (online) update indicator's concern, not this endpoint's. The shape lives in shared (see
 * features/about/Changelog.ts); the server parses CHANGELOG.md into it. */
export function fetchChangelog() {
	return Api.get<Array<ChangelogSection>>('/meta/changelog')
}

/** Records the version whose release notes the user has seen — the What's-New dot stays dark until
 * the instance moves past it again. */
export async function setSeenVersion(version: string) {
	return currentUser = await Api.put<User>('/user/seen-version', { version })
}

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

/** Every source on show right now, across accounts and in display order. */
export function getVisibleSources(): Array<Source> {
	return integrations.flatMap(i => [...i.sources]).filter(s => s.visible)
}

/** Fetches all entries referenced in the user's relationship graph for client-side graph calculations. */
export function getRelationClosure() {
	return Api.get<Array<Entry>>(`/entries/relations/closure?tz=${tz()}`)
}

/** THE write path for relationships (see RelationsField) — always a relations-only partial PUT to
 * the series master; the backend treats absent fields as "keep", so nothing else moves. Full entry
 * PUTs deliberately never carry relations. */
export function updateRelations(id: string, relations: Array<Relation> | null) {
	return Api.put<Entry>(`/entries/${id}?tz=${tz()}`, { relations })
}

/** The source a create targets: the user's default when visible, else the first visible one. Passing
 * the kind being created narrows it to the sources that can hold one — a surface that only makes
 * tasks (the timeline, the unscheduled section) must not land them in an events-only calendar. */
export function getPrimarySource(type?: EntryType): Source | undefined {
	const visibleSources = getVisibleSources().filter(s => !type || s.supportsEntryType(type))
	return visibleSources.find(s => s.id === getDefaultSourceId()) ?? visibleSources[0]
}

export function createEvent(entry: Entry) {
	// The entry travels as ITSELF — `@a11d/api` deconstructs it on the way out, which is what maps the
	// members behind accessors onto their wire names (see Entry._type). A spread here would flatten it
	// into a plain object first and send the backing fields.
	return Api.post<Entry>(`/entries?tz=${tz()}`, Object.assign(entry.clone(), {
		// Stamp the zone the times were authored in — recurrence must expand at THIS zone's wall clock
		// ("every Monday 09:00 Berlin" survives DST), and the future zone selector edits this field.
		timeZone: entry.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
	}))
}

export async function fetchIntegrations() {
	const fetched = await Api.get<Array<Integration>>('/integrations')
	// Display order is ONE comparator (infrastructure/model/order.ts byOrder) applied at this boundary: the server
	// responds in natural (insertion) order, and the STABLE sort floats manually placed rows over it
	// while keeping the never-ordered rest exactly as it always was.
	for (const integration of fetched) {
		integration.sources = [...integration.sources].sort(byOrder) as unknown as Integration['sources']
	}
	return integrations = fetched.sort(byOrder)
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
 * Enabled sources in display order (across all accounts or a single integration).
 * Unlike visible sources, enabled sources include hidden calendars that can still hold entries.
 */
export function getEnabledSources(integration?: Integration) {
	const sources = integration ? [...integration.sources] : integrations.flatMap(i => [...i.sources])
	return sources.filter(source => source.enabled)
}

/** Returns effective capabilities for a source, combining provider capabilities with source-level permissions. */
export function getCapabilities(sourceId: string): Integration['capabilities'] {
	return Integration.capabilitiesIn(getIntegrationFor(sourceId)?.capabilities ?? Integration.fullCapabilities, getSource(sourceId))
}

/**
 * Where an entry can be opened outside mitra, if anywhere (see Integration.externalLink). A provider
 * the client doesn't model arrives without the method, like the capabilities above — it still gets
 * the link, just unlabelled, since the URL is the entry's own data either way.
 */
export function getExternalLink(entry: Entry): { url: string, label?: string } | undefined {
	const url = Integration.externalUrlOf(entry)
	return getIntegrationFor(entry.sourceId)?.externalLink?.(entry) ?? (url ? { url } : undefined)
}

/** True if at least one writable destination source exists for copying entries out. */
export function canCopyEntriesOut(source: Source) {
	return getEnabledSources().some(other => other.id !== source.id && getCapabilities(other.id).createEntries)
}

/** True if entries can be moved out (requires canCopyEntriesOut and deleteEntries permission on origin). */
export function canMoveEntriesOut(source: Source) {
	return canCopyEntriesOut(source) && getCapabilities(source.id).deleteEntries
}

export function toggleSourceVisibility(id: string, hidden: boolean) {
	return Api.put(`/sources/${id}/visibility`, { hidden })
}

/** "Only show this calendar". Refetches instead of updating the store optimistically like rename or
 * recolour do — a solo rewrites every row at once, and re-deriving the server's rule here is how the
 * sidebar and the calendar would drift apart. */
export async function soloSource(id: string) {
	currentUser = await Api.put<User>(`/sources/${id}/solo`)
	await fetchIntegrations()
}

/** The way back out. Safe to call with nothing to restore — the server just answers with the current
 * truth, which re-syncs a tab whose record another tab already spent. */
export async function restoreSourceVisibility() {
	currentUser = await Api.put<User>('/sources/restore-visibility')
	await fetchIntegrations()
}

/** Whether there is a solo to leave. Tests the record itself, never its length — an empty one still
 * means soloed (see User.previouslyHiddenSourceIds). */
export function canRestoreSourceVisibility() {
	return !!currentUser?.previouslyHiddenSourceIds
}

export function updateSourceColor(id: string, color: string) {
	return Api.put(`/sources/${id}/color`, { color })
}

export function renameSource(id: string, name: string) {
	return Api.put<Source>(`/sources/${id}/name`, { name })
}

/** Persist a new source order within `integration` — `ids` is its visible rows in their new order.
 * The local store is re-sorted first with the very rule the server writes (see infrastructure/model/order.ts),
 * so the sidebar reflects the change without a refetch, like rename/recolour. */
export function reorderSources(integration: Integration, ids: Array<string>) {
	const sources = [...integration.sources]
	applyOrder(sources, ids)
	integration.sources = sources.sort(byOrder) as unknown as Integration['sources']
	return Api.put('/sources/order', { ids })
}

/** Persist a new account order — all of the user's integrations in their new order, applied to the
 * local store first (mirrors {@link reorderSources}). */
export function reorderIntegrations(ids: Array<string>) {
	applyOrder(integrations, ids)
	integrations.sort(byOrder)
	return Api.put('/integrations/order', { ids })
}

/**
 * Re-import: throw the local cache away and rebuild it from the provider. NOT a sync — that one
 * pulls deltas continuously in the background and has no client-side trigger at all (an opening
 * or reloading page syncs by itself, via the event stream's presence).
 */
export function reimportSource(id: string) {
	return Api.post(`/sources/${id}/reimport`)
}

/** Fetches fidelity preview for moving or copying entries to targetSourceId. */
export function previewSourceMigration(sourceId: string, targetSourceId: string, keepOriginals: boolean) {
	return Api.post<MigrationPlan>(`/sources/${sourceId}/migrate/preview`, { targetSourceId, keepOriginals })
}

/** Executes bulk source migration (move or copy). */
export function migrateSourceEntries(sourceId: string, options: { targetSourceId: string, flatten: boolean, keepOriginals: boolean }) {
	return Api.post<MigrationOutcome>(`/sources/${sourceId}/migrate`, options)
}

export function reimportIntegration(id: string) {
	return Api.post(`/integrations/${id}/reimport`)
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
			// Free/busy has no "unset" to express (the editor offers Busy and Free), so an undefined
			// value simply drops out of the JSON and the backend keeps the series'. `visibility` DOES —
			// its `null` is the pickable "calendar default" — so it always rides along.
			transparency: entry.transparency ?? null,
			visibility: entry.visibility ?? null,
			reminders: entry.reminders ?? null,
			participants: entry.participants ?? null,
			...(entry.recurrence !== undefined ? { recurrence: entry.recurrence } : {}),
		})
	}
	// The full entry as itself (like createEvent), with absent tri-state fields sent as an explicit
	// `null`: JSON drops undefined keys and the backend treats absence as "keep" — only a null can
	// express a removal.
	return Api.put<Entry>(`/entries/${entry.id}?tz=${tz()}`, Object.assign(entry.clone(), {
		recurrence: entry.recurrence ?? null,
		reminders: entry.reminders ?? null,
		participants: entry.participants ?? null,
		// Tri-state for the same reason: "no dates" only reaches the server as an explicit null.
		start: entry.start ?? null,
		end: entry.end ?? null,
	}))
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

/** Location autocomplete via the backend's geocoder proxy (see features/locations/server/locations.ts). The UI language
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
		// Pass sourceId so scoped occurrence edits can move the resulting entity/series to target source.
		sourceId: occurrence.sourceId,
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
		participants: occurrence.participants ?? null,
	})
}

/** Delete an occurrence from its series with a scope (this / following) — DELETE carries no body, so
 * the scope + occurrence start go as query params. ('all' deletes the master via deleteEvent.) */
export function deleteOccurrence(occurrence: Entry, scope: RecurrenceScope) {
	const query = new URLSearchParams({ scope, recurrenceId: occurrence.recurrenceId!.toISOString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
	return Api.delete(`/entries/${occurrence.recurrenceMasterId}?${query}`)
}
