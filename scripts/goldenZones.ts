import fs from 'node:fs'
import { createRequire } from 'node:module'

/**
 * Writes the zone each region names a time zone after (Toronto in Canada, New York elsewhere), which Intl hides; only
 * names in use today count. Each zone goes in both spellings, as Chromium lists CLDR's (`Asia/Calcutta`) and Firefox
 * IANA's (`Asia/Kolkata`). Run after updating `cldr-core`.
 */

type MetazoneUses = ReadonlyArray<{ readonly usesMetazone: { readonly _mzone: string, readonly _to?: string } }>

interface ZoneTree {
	readonly [segment: string]: ZoneTree | MetazoneUses
}

interface MetaZones {
	readonly supplemental: {
		readonly metaZones: {
			readonly metazones: ReadonlyArray<{ readonly mapZone: { readonly _other: string, readonly _type: string, readonly _territory: string } }>
			readonly metazoneInfo: { readonly timezone: ZoneTree }
		}
	}
}

interface Bcp47TimeZones {
	readonly keyword: { readonly u: { readonly tz: Record<string, { readonly _alias?: string }> } }
}

const require = createRequire(import.meta.url)
const { supplemental } = require('cldr-core/supplemental/metaZones.json') as MetaZones
const { keyword } = require('cldr-bcp47/bcp47/timezone.json') as Bcp47TimeZones

const spellings = new Map<string, ReadonlyArray<string>>()
for (const { _alias } of Object.values(keyword.u.tz)) {
	const names = _alias?.split(' ') ?? []
	for (const name of names) {
		spellings.set(name, names)
	}
}

/** The time name a zone uses today, the one of its history without an end. */
function metazoneOf(id: string) {
	const uses = id.split('/').reduce<ZoneTree | MetazoneUses | undefined>((tree, segment) => (tree as ZoneTree | undefined)?.[segment], supplemental.metaZones.metazoneInfo.timezone)
	return Array.isArray(uses) ? (uses as MetazoneUses).find(use => !use.usesMetazone._to)?.usesMetazone._mzone : undefined
}

const byRegion = new Map<string, Set<string>>()
for (const { mapZone } of supplemental.metaZones.metazones.filter(({ mapZone }) => metazoneOf(mapZone._type) === mapZone._other)) {
	const zones = byRegion.get(mapZone._territory) ?? new Set()
	for (const name of spellings.get(mapZone._type) ?? [mapZone._type]) {
		zones.add(name)
	}
	byRegion.set(mapZone._territory, zones)
}

const sorted = Object.fromEntries([...byRegion].sort(([a], [b]) => a.localeCompare(b)).map(([region, zones]) => [region, [...zones].sort()]))
fs.writeFileSync(new URL('../src/features/time/goldenZones.json', import.meta.url), `${JSON.stringify(sorted, undefined, '\t')}\n`)
