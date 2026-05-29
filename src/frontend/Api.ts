import { Api } from '@a11d/api'
import { DateTime } from '@3mo/date-time'
import type { Entry, Integration } from 'shared'

let integrations = new Array<Integration>()

export function fetchEvents(start: DateTime, end: DateTime) {
	return Api.get<Array<Entry>>(`/entries?start=${start.toISOString()}&end=${end.toISOString()}`)
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

export function updateEvent(entry: Entry) {
	return Api.put<Entry>(`/entries/${entry.id}`, entry)
}
