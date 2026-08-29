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
import { type UserSettings } from '../../features/settings/UserSettings.js'

/** Custom API error class extracting backend error messages. */
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

let integrations = new Array<Integration>()
let currentUser: User | undefined

/** Instance metadata from backend `/meta`. */
export interface InstanceMeta {
	name: string
	version: string
	commit: string
	node: string
	releaseUrl?: string
	update?: { version: string, url: string, commits?: number }
}

let meta: InstanceMeta | undefined
let metaFetchedAt = 0

const metaMaxAge = 6 * 60 * 60 * 1000

export async function fetchMeta() {
	metaFetchedAt = Date.now()
	return meta = await Api.get<InstanceMeta>('/meta').catch(() => undefined)
}

/** Refresh instance metadata if older than 6 hours. */
export async function refreshMetaIfStale() {
	if (Date.now() - metaFetchedAt > metaMaxAge) {
		await fetchMeta()
	}
	return meta
}

export function getMeta() {
	return meta
}

/** Whether the running client bundle is older than the server version. */
export function isBundleStale() {
	return !!meta && meta.version !== mitra.version
}

export function fetchChangelog() {
	return Api.get<Array<ChangelogSection>>('/meta/changelog')
}

export async function setSeenVersion(version: string) {
	return currentUser = await Api.put<User>('/user/seen-version', { version })
}

const tz = () => encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)

export async function fetchUser() {
	return currentUser = await Api.get<User>('/user')
}

export function getUser() {
	return currentUser
}

export function getDefaultSourceId(): string | undefined {
	return currentUser?.defaultSourceId ?? undefined
}

export async function setDefaultSource(sourceId: string | undefined) {
	return currentUser = await Api.put<User>('/user/default-source', { sourceId: sourceId ?? null })
}

export function getTimeZones(): Array<UserTimeZone> {
	return currentUser?.timeZones ?? []
}

export async function setTimeZones(timeZones: Array<UserTimeZone>) {
	return currentUser = await Api.put<User>('/user/time-zones', { timeZones })
}

export function getSettings(): UserSettings {
	return currentUser?.settings ?? {}
}

export async function setSettings(settings: UserSettings) {
	return currentUser = await Api.put<User>('/user/settings', { settings })
}

export function fetchEvents(start: DateTime, end: DateTime) {
	return Api.get<Array<Entry>>(`/entries?start=${start.toISOString()}&end=${end.toISOString()}&tz=${tz()}`)
}

/** Full-text search across all visible entries. */
export function searchEntries(query: string) {
	return Api.get<Array<Entry>>(`/entries/search?q=${encodeURIComponent(query)}&tz=${tz()}`)
}

/** All visible sources across accounts in display order. */
export function getVisibleSources(): Array<Source> {
	return integrations.flatMap(i => [...i.sources]).filter(s => s.visible)
}

/** Fetches all entries referenced in the user's relationship graph for client-side graph calculations. */
export function getRelationClosure() {
	return Api.get<Array<Entry>>(`/entries/relations/closure?tz=${tz()}`)
}

/** Update entry relationships via master entry PUT. */
export function updateRelations(id: string, relations: Array<Relation> | null) {
	return Api.put<Entry>(`/entries/${id}?tz=${tz()}`, { relations })
}

/** Default target source for newly created entries. */
export function getPrimarySource(type?: EntryType): Source | undefined {
	const visibleSources = getVisibleSources().filter(s => !type || s.supportsEntryType(type))
	return visibleSources.find(s => s.id === getDefaultSourceId()) ?? visibleSources[0]
}

export function createEvent(entry: Entry) {
	return Api.post<Entry>(`/entries?tz=${tz()}`, Object.assign(entry.clone(), {
		timeZone: entry.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
	}))
}

export async function fetchIntegrations() {
	const fetched = await Api.get<Array<Integration>>('/integrations')
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
 * Where an entry can be opened outside mitra, if anywhere.
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

/** Show only the specified source, saving current visibility state. */
export async function soloSource(id: string) {
	currentUser = await Api.put<User>(`/sources/${id}/solo`)
	await fetchIntegrations()
}

/** Restore source visibility prior to solo. */
export async function restoreSourceVisibility() {
	currentUser = await Api.put<User>('/sources/restore-visibility')
	await fetchIntegrations()
}

/** Whether there is a previous solo state to restore. */
export function canRestoreSourceVisibility() {
	return !!currentUser?.previouslyHiddenSourceIds
}

export function updateSourceColor(id: string, color: string) {
	return Api.put(`/sources/${id}/color`, { color })
}

export function renameSource(id: string, name: string) {
	return Api.put<Source>(`/sources/${id}/name`, { name })
}

/** Persist updated source order within an integration. */
export function reorderSources(integration: Integration, ids: Array<string>) {
	const sources = [...integration.sources]
	applyOrder(sources, ids)
	integration.sources = sources.sort(byOrder) as unknown as Integration['sources']
	return Api.put('/sources/order', { ids })
}

/** Persist updated integration order across accounts. */
export function reorderIntegrations(ids: Array<string>) {
	applyOrder(integrations, ids)
	integrations.sort(byOrder)
	return Api.put('/integrations/order', { ids })
}

/** Clear local cache and re-import all entries from remote source. */
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

/** Start Google OAuth PKCE flow. */
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
	if (entry.recurrenceMasterId) {
		return Api.put<Entry>(`/entries/${entry.recurrenceMasterId}?tz=${tz()}`, {
			heading: entry.heading,
			description: entry.description,
			location: entry.location,
			color: entry.color,
			timeZone: entry.timeZone ?? null,
			transparency: entry.transparency ?? null,
			visibility: entry.visibility ?? null,
			reminders: entry.reminders ?? null,
			participants: entry.participants ?? null,
			...(entry.recurrence !== undefined ? { recurrence: entry.recurrence } : {}),
		})
	}
	return Api.put<Entry>(`/entries/${entry.id}?tz=${tz()}`, Object.assign(entry.clone(), {
		recurrence: entry.recurrence ?? null,
		reminders: entry.reminders ?? null,
		participants: entry.participants ?? null,
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
	type?: string
	recent?: boolean
}

/** Location autocomplete query via backend Photon proxy. */
export function searchLocations(query: string, position?: { lat: number, lon: number }) {
	const params = new URLSearchParams({ q: query, lang: navigator.language.split('-')[0] ?? 'en' })
	if (position) {
		params.set('lat', String(position.lat))
		params.set('lon', String(position.lon))
	}
	return Api.get<Array<LocationSuggestion>>(`/locations?${params}`)
}

/** Apply scoped edits (this / following / all) to a recurring occurrence. */
export function editOccurrence(occurrence: Entry, scope: RecurrenceScope) {
	return Api.put<Entry>(`/entries/${occurrence.recurrenceMasterId}?tz=${tz()}`, {
		scope,
		recurrenceId: occurrence.recurrenceId,
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

/** Delete an occurrence from a recurring series by scope. */
export function deleteOccurrence(occurrence: Entry, scope: RecurrenceScope) {
	const query = new URLSearchParams({ scope, recurrenceId: occurrence.recurrenceId!.toISOString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
	return Api.delete(`/entries/${occurrence.recurrenceMasterId}?${query}`)
}
