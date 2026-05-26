import { Api } from '@a11d/api'
import { DateTime } from '@3mo/date-time'
import { Entry, type Integration } from 'shared'

export function fetchEvents(start: DateTime, end: DateTime) {
	return Api.get<Array<Entry>>(`/entries?start=${start.toISOString()}&end=${end.toISOString()}`)
}

export function fetchIntegrations() {
	return Api.get<Array<Integration>>('/integrations')
}

export function toggleSourceVisibility(id: string, hidden: boolean) {
	return Api.put(`/sources/${id}/visibility`, { hidden })
}
