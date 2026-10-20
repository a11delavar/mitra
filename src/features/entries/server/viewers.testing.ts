import { DateTime, DateTimeRange } from '@3mo/date-time'
import { EntryOccurrences } from '#features/recurrence'
import { TimeZone } from '#features/time/TimeZone.js'
import { fetchEvents } from '#infrastructure/http/Api.js'
import { Entry } from '../Entry.js'

/*
	Viewers in different zones, for the entries' tests: a viewer is this process's zone (`process.env.TZ`), which the
	browser's Intl and Date both follow, and the zone its `Entry` reads days in.
*/

export const zones = { berlin: 'Europe/Berlin', newYork: 'America/New_York', tehran: 'Asia/Tehran', auckland: 'Pacific/Auckland' }

/** Makes this process a viewer in `zone`, reading days there as a browser does. */
export const viewIn = (zone: string) => {
	process.env.TZ = zone
	Entry.dayZone = () => TimeZone.of(zone)
}

/** The midnight that begins `day` where this process is. */
export const midnight = (day: string) => new DateTime(TimeZone.of(process.env.TZ!).midnightOf(Temporal.PlainDate.from(day)).getTime())

export const utcMidnight = (day: string) => Date.UTC(...day.split('-').map(Number).map((part, index) => index === 1 ? part - 1 : part) as [number, number, number])

export const iso = (value: { valueOf(): number } | null | undefined) => value === null || value === undefined ? value : new Date(value.valueOf()).toISOString()

export const range = (from: string, to: string) => new DateTimeRange(midnight(from), midnight(to))

/** The window's entries as stored, as this viewer fetches them. */
export const fetched = (from: string, to: string) => fetchEvents(range(from, to))

/** The window as the views show it: each entry's occurrences there. */
export const shown = async (from: string, to: string) => {
	const entries = await fetched(from, to)
	return [...entries.filter(entry => !entry.recurrence).map(entry => entry.occurrences.single), ...EntryOccurrences.inWindow(entries, range(from, to))]
}
