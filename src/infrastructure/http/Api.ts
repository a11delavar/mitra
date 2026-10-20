import { LocationSuggestion } from '../../features/locations/LocationSuggestion.js'
import { Api, HttpError, apiError, apiAuthenticator, type ApiAuthenticator } from '@a11d/api'
import { type DateTimeRange } from '@3mo/date-time'
import { type User } from '../../features/identity/User.js'
import { type Source } from '../../features/sources/Source.js'
import { type Color } from '../../features/sources/Color.js'
import { type MigrationOutcome, type MigrationPlan } from '../../features/migration/MigrationPlan.js'
import { EntryRelations } from '../../features/relations/EntryRelations.js'
import { Integration } from '../../integrations/Integration.js'
import { type EntryType } from '../../features/entries/EntryType.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryPatch, type EntryPatchField } from '../../features/entries/EntryPatch.js'
import { EntryTimeZone } from '../../features/entries/EntryTimeZone.js'
import { TimeZone } from '../../features/time/TimeZone.js'
import { type ChangelogSection } from '../../features/about/Changelog.js'
import { type ReleaseFolder } from '../../features/about/Release.js'
import { type UserSettings } from '../../features/settings/UserSettings.js'
import { type EntryOccurrenceChangeScope } from '../../features/recurrence/EntryOccurrenceChange.js'
import { type EntryOccurrence } from '../../features/recurrence/EntryOccurrence.js'
import { EntryFile } from '../../features/entries/EntryFile.js'

@apiError()
export class ApiError extends HttpError {
	get status() {
		return this.response.status
	}

	override async throw(): Promise<never> {
		if (this.status === 401) {
			location.assign(`/auth/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)
		}
		const body = await this.response.json().catch(() => undefined) as { error?: string } | undefined
		this.message = body?.error || this.response.statusText || `Request failed (${this.response.status})`
		throw this
	}
}

/** Include session credentials with API requests for auth proxy compatibility. */
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

let currentUser: User | undefined

export interface InstanceMeta {
	/** The operator's `MITRA_NAME`, if any. */
	name?: string
	version: string
	commit: string
	node: string
	development?: boolean
	demo?: boolean
	releaseUrl?: string
	update?: { version: string, url: string, commits?: number }
	/** The largest file in bytes (0 takes no uploads), and each account's total. */
	files?: { maxSize: number, quota?: number }
	/** Whether people sign in, so an agent needs an access token. */
	signIn?: boolean
	/** Whether agents may connect over MCP (`MITRA_MCP`). */
	mcp?: boolean
}

let meta: InstanceMeta | undefined
let metaFetchedAt = 0

const metaMaxAge = 6 * 60 * 60 * 1000

export async function fetchMeta() {
	metaFetchedAt = Date.now()
	return meta = await Api.get<InstanceMeta>('/meta').catch(() => undefined)
}

export async function refreshMetaIfStale() {
	if (Date.now() - metaFetchedAt > metaMaxAge) {
		await fetchMeta()
	}
	return meta
}

export function getMeta() {
	return meta
}

/** The operator's `MITRA_NAME`, else Mitra's own name in the current language. */
export function instanceName() {
	return meta?.name ?? String(t('Mitra'))
}

export function isBundleStale() {
	return !!meta && meta.version !== mitra.version
}

/** The changelog for the running build and the release folders it carries, which `Release.list()` makes releases of. */
export function fetchReleases() {
	return Api.get<{ sections: Array<ChangelogSection>, folders: Array<ReleaseFolder> }>('/meta/releases')
}

export async function setSeenVersion(version: string) {
	return currentUser = await Api.put<User>('/user/seen-version', { version })
}

export async function fetchUser() {
	return currentUser = await Api.get<User>('/user')
}

export function getUser() {
	return currentUser
}

export async function setDefaultSource(sourceId: string | undefined) {
	return currentUser = await Api.put<User>('/user/default-source', { sourceId: sourceId ?? null })
}

export async function settleTimeZone(id: string) {
	return currentUser = await Api.post<User>('/user/time-zones/settle', { id })
}

export async function makeHomeTimeZone(id: string) {
	return currentUser = await Api.put<User>('/user/time-zones/home', { id })
}

export async function addTimeZone(id: string) {
	return currentUser = await Api.post<User>('/user/time-zones', { id })
}

export async function removeTimeZone(id: string) {
	return currentUser = await Api.delete<User>(`/user/time-zones/${encodeURIComponent(id)}`)
}

export async function renameTimeZone(id: string, label: string | undefined) {
	return currentUser = await Api.put<User>(`/user/time-zones/${encodeURIComponent(id)}/label`, { label: label ?? null })
}

export function getSettings(): UserSettings {
	return currentUser?.settings ?? {}
}

export async function setSettings(settings: UserSettings) {
	return currentUser = await Api.put<User>('/user/settings', { settings })
}

/** The window's entries, each recurring entry once, whose dates the store expands. */
export function fetchEvents(window: DateTimeRange) {
	return Api.get<Array<Entry>>(`/entries?start=${window.start!.toISOString()}&end=${window.end!.toISOString()}`)
}

/** Every visible entry whatever its dates, each recurring entry once. */
export function fetchAllEntries() {
	return Api.get<Array<Entry>>('/entries/all')
}

export function searchEntries(query: string) {
	return Api.get<Array<Entry>>(`/entries/search?${new URLSearchParams({ query })}`)
}

/** Stores tasks' places in the manual order, as rank keys by entry id. */
export function rankEntries(ranks: Record<string, string>) {
	return Api.put<void>('/entries/ranks', { ranks })
}

/** Writes the relations an entry owns: what it reads back from others is theirs. */
export function updateRelations(id: string, relations: EntryRelations) {
	return Api.put<Entry>(`/entries/${id}`, Object.assign(new EntryPatch(), { relations }))
}

export function createEvent(entry: Entry) {
	return Api.post<Entry>('/entries', Object.assign(EntryPatch.of(entry), {
		timeZone: entry.timeZone ?? EntryTimeZone.parse(TimeZone.deviceId) ?? null,
	}))
}

/** The user's integrations with their sources, in no particular order: `Calendars.fetch()` orders and keeps them. */
export function fetchIntegrations() {
	return Api.get<Array<Integration>>('/integrations')
}

export function toggleSourceVisibility(id: string, hidden: boolean) {
	return Api.put(`/sources/${id}/visibility`, { hidden })
}

export async function soloSource(id: string) {
	currentUser = await Api.put<User>(`/sources/${id}/solo`)
}

export async function restoreSourceVisibility() {
	currentUser = await Api.put<User>('/sources/restore-visibility')
}

/** Requires `capabilities.sources.create`. */
export function createSource(integrationId: string, init: { name: string, color?: string, entryTypes?: Array<EntryType> }) {
	return Api.post<Source>(`/integrations/${integrationId}/sources`, init)
}

export function countSourceEntries(id: string) {
	return Api.get<number>(`/sources/${id}/entries/count`)
}

/** Deletes the calendar and all its entries. Requires `capabilities.sources.delete`. */
export function deleteSource(id: string) {
	return Api.delete(`/sources/${id}`)
}

export function updateSourceColor(id: string, color: Color) {
	return Api.put(`/sources/${id}/color`, { color: color.value })
}

export function renameSource(id: string, name: string) {
	return Api.put<Source>(`/sources/${id}/name`, { name })
}

export function putSourceOrder(ids: Array<string>) {
	return Api.put('/sources/order', { ids })
}

export function putIntegrationOrder(ids: Array<string>) {
	return Api.put('/integrations/order', { ids })
}

export function reimportSource(id: string) {
	return Api.post(`/sources/${id}/reimport`)
}

/** Fidelity preview of moving or copying entries to `targetSourceId`. */
export function previewSourceMigration(sourceId: string, targetSourceId: string, keepOriginals: boolean) {
	return Api.post<MigrationPlan>(`/sources/${sourceId}/migrate/preview`, { targetSourceId, keepOriginals })
}

export function migrateSourceEntries(sourceId: string, options: { targetSourceId: string, flatten: boolean, keepOriginals: boolean }) {
	return Api.post<MigrationOutcome>(`/sources/${sourceId}/migrate`, options)
}

export function reimportIntegration(id: string) {
	return Api.post(`/integrations/${id}/reimport`)
}

/** Posts a raw iCalendar body: text/calendar bypasses the JSON transport and its body size limit. */
async function postCalendar<T>(route: string, ics: string): Promise<T> {
	const response = await fetch(Api.url + route, {
		method: 'POST',
		credentials: 'include',
		headers: { 'accept': 'application/json', 'content-type': 'text/calendar' },
		body: ics,
	})
	if (response.status >= 400) {
		await new ApiError(response).throw()
	}
	return JSON.parse(await response.text(), (_, value) => [...Api.valueConstructors].find(converter => converter.shallConstruct(value))?.construct(value) ?? value) as T
}

/** Fidelity preview of importing a calendar file's entries into a target source. */
export function previewIcsImport(targetSourceId: string, ics: string) {
	return postCalendar<MigrationPlan>(`/sources/${targetSourceId}/ics/preview`, ics)
}

export function importIcs(targetSourceId: string, ics: string) {
	return postCalendar<MigrationOutcome>(`/sources/${targetSourceId}/ics`, ics)
}

export function discoverSources(integration: Integration) {
	return Api.post<Array<Source>>('/integrations/sources', integration)
}

/** Whether this deployment can connect Google accounts (MITRA_GOOGLE_CLIENT_ID configured). */
export function fetchGoogleAvailability() {
	return Api.get<{ configured: boolean }>('/integrations/google')
}

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

/** Writes `fields` of the entry, or of every occurrence of a repeating one: those they all share, unless told otherwise. */
export function updateEvent(entry: Entry, fields: ReadonlyArray<EntryPatchField> = entry.recurringEntryId ? EntryPatch.shared : EntryPatch.fields) {
	return Api.put<Entry>(`/entries/${entry.recurringEntryId ?? entry.id}`, EntryPatch.of(entry, fields))
}

export function deleteEvent(id: string) {
	return Api.delete(`/entries/${id}`)
}

/** Stores a file for an entry to refer to. The body is the file itself, its type and name on the standard headers, so it bypasses the JSON transport. */
export async function uploadFile(file: globalThis.File) {
	const response = await fetch(Api.url + '/files', {
		method: 'POST',
		credentials: 'include',
		headers: {
			'accept': 'application/json',
			'content-type': file.type || 'application/octet-stream',
			'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
		},
		body: file,
	})
	if (response.status >= 400) {
		await new ApiError(response).throw()
	}
	return EntryFile.from(await response.json())!
}

/** Location autocomplete query via backend Photon proxy. */
export function searchLocations(query: string, position?: { lat: number, lon: number }) {
	const params = new URLSearchParams({ q: query, lang: Localizer.locales.current.language })
	if (position) {
		params.set('lat', String(position.lat))
		params.set('lon', String(position.lon))
	}
	return Api.get<Array<Partial<LocationSuggestion>>>(`/locations?${params}`).then(places => places.map(place => new LocationSuggestion(place)))
}

/** One occurrence of a repeating entry, by the date its entry stores it under, with how far a change to it reaches. */
function occurrenceUrl(occurrence: EntryOccurrence, scope: EntryOccurrenceChangeScope) {
	const at = encodeURIComponent(occurrence.storedRecurrenceId!.toISOString())
	return `/entries/${encodeURIComponent(occurrence.recurringEntryId!)}/occurrences/${at}?${new URLSearchParams({ scope })}`
}

/** The date `occurrence` stands for, as its entry now has it. */
export function editOccurrence(occurrence: EntryOccurrence, scope: EntryOccurrenceChangeScope) {
	return Api.put<Entry>(occurrenceUrl(occurrence, scope), EntryPatch.of(occurrence.entry, EntryPatch.occurrence))
}

export function deleteOccurrence(occurrence: EntryOccurrence, scope: EntryOccurrenceChangeScope) {
	return Api.delete(occurrenceUrl(occurrence, scope))
}
