import { Api, HttpError, apiError } from '@a11d/api'
import { DateTime } from '@3mo/date-time'
import type { Entry, Integration, Source } from 'shared'

/**
 * Surface the server's error message on failed responses. Without a registered
 * constructor, `@a11d/api` falls back to `new Error(await response.json())`, which
 * stringifies the JSON body to "[object Object]". The backend always replies with
 * `{ error: string }`, so lift that into the thrown `Error`'s message.
 */
@apiError()
export class ApiError extends HttpError {
	override async throw(): Promise<never> {
		const body = await this.response.json().catch(() => undefined) as { error?: string } | undefined
		this.message = body?.error || this.response.statusText || `Request failed (${this.response.status})`
		throw this
	}
}

let integrations = new Array<Integration>()

export function fetchEvents(start: DateTime, end: DateTime) {
	return Api.get<Array<Entry>>(`/entries?start=${start.toISOString()}&end=${end.toISOString()}`)
}

export function createEvent(entry: Entry) {
	return Api.post<Entry>('/entries', entry)
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

export function toggleSourceVisibility(id: string, hidden: boolean) {
	return Api.put(`/sources/${id}/visibility`, { hidden })
}

export function updateSourceColor(id: string, color: string) {
	return Api.put(`/sources/${id}/color`, { color })
}

export function discoverSources(integration: Integration) {
	return Api.post<Array<Source>>('/integrations/sources', integration)
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
	return Api.put<Entry>(`/entries/${entry.id}`, entry)
}

export function deleteEvent(id: string) {
	return Api.delete(`/entries/${id}`)
}
