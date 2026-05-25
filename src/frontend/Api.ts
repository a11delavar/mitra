import { Api } from '@a11d/api'
import { DateTime } from '@3mo/date-time'
import { Entry } from 'shared'

export function fetchEvents(start: DateTime, end: DateTime) {
	return Api.get<Array<Entry>>(`/entries?start=${start.toISOString()}&end=${end.toISOString()}`)
}
