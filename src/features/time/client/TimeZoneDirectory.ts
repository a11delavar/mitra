import { Memoize as memoize } from 'typescript-memoize'
import { Localizer } from '@3mo/localization'
import { TimeZone } from '../TimeZone.js'

export interface TimeZoneRow {
	readonly zone: TimeZone
	readonly id: string
	readonly city: string
	readonly country: string
	readonly region?: string
	/** Everything a search may find it by, lowercased. */
	readonly terms: string
}

/** Zones that keep the same name and the same clock the year round, which a user picks between by city alone. */
export interface TimeZoneGroup {
	readonly name: string
	readonly offset: string
	readonly offsetMinutes: number
	readonly zones: ReadonlyArray<TimeZoneRow>
	/** The group's own words, which find all of its zones. */
	readonly terms: string
}

/**
 * Every IANA zone grouped by name and yearly offsets: some 160 groups instead of 400 rows. Memoized per locale, as
 * building it asks Intl a few thousand times.
 */
export class TimeZoneDirectory {
	static get current() {
		return TimeZoneDirectory.of(String(Localizer.locales.current))
	}

	@memoize()
	static of(locale: string) {
		return new TimeZoneDirectory(new Intl.Locale(locale))
	}

	readonly groups: ReadonlyArray<TimeZoneGroup>

	private constructor(readonly locale: Intl.Locale) {
		const now = new Date()
		const countries = new Intl.DisplayNames([locale], { type: 'region' })
		const groups = new Map<string, { name: string, offset: string, offsetMinutes: number, zones: Array<TimeZoneRow> }>()
		for (const id of Intl.supportedValuesOf('timeZone')) {
			const zone = TimeZone.of(id)
			const name = zone.name(locale, now)
			const region = zone.region
			const country = region ? countries.of(region) ?? '' : ''
			const key = `${name.generic} ${zone.yearlyOffsets.join(' ')}`
			const group = groups.get(key) ?? { name: name.generic, offset: name.offset, offsetMinutes: zone.offsetAt(now), zones: [] }
			group.zones.push({ zone, id, city: name.city, country, region, terms: `${id} ${name.city} ${country} ${name.long}`.toLowerCase() })
			groups.set(key, group)
		}
		this.groups = [...groups.values()]
			.map(group => ({
				...group,
				zones: group.zones.sort((a, b) => a.city.localeCompare(b.city, locale.baseName)),
				terms: `${group.name} ${group.offset}`.toLowerCase(),
			}))
			.sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.name.localeCompare(b.name, locale.baseName))
	}

	/**
	 * The groups narrowed to `query` and to `accept`, each with the zone it stands for and the others under it: the
	 * first of `preferred` it holds, else its main city. A group found by its own words keeps all of them.
	 */
	find(query: string, accept: (zone: TimeZoneRow) => boolean, region: string | undefined, preferred: ReadonlyArray<string>): Array<TimeZoneTree> {
		const words = query.trim().toLowerCase()
		return this.groups.flatMap(group => {
			const accepted = group.zones.filter(accept)
			const main = preferred.map(id => accepted.find(zone => zone.id === id)).find(zone => !!zone) ?? TimeZoneDirectory.mainOf(accepted, region)
			const whole = !words || group.terms.includes(words)
			const found = whole ? accepted : accepted.filter(zone => zone.terms.includes(words))
			return !main || !found.length ? [] : [{ ...group, main, others: found.filter(zone => zone !== main) }]
		})
	}

	/**
	 * The zone a group stands for: CLDR's golden zone for the user's country (Toronto for a Canadian), else a city in that
	 * country (one named for a subdivision, `America/North_Dakota/Beulah`, last), else the worldwide golden zone.
	 */
	private static mainOf(zones: ReadonlyArray<TimeZoneRow>, region?: string) {
		const local = zones
			.filter(zone => zone.region === region)
			.toSorted((a, b) => a.id.split('/').length - b.id.split('/').length)
		return local.find(({ zone }) => zone.isGoldenIn(region)) ?? local.find(({ zone }) => zone.isGoldenIn()) ?? local[0]
			?? zones.find(({ zone }) => zone.isGoldenIn()) ?? zones[0]
	}
}

/** A group as the picker lists it: the zone its header stands for, and the others folded under it. */
export interface TimeZoneTree extends TimeZoneGroup {
	readonly main: TimeZoneRow
	readonly others: ReadonlyArray<TimeZoneRow>
}
