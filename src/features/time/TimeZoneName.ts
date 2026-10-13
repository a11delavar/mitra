import type { TimeZone } from './TimeZone.js'

/**
 * How a time zone is called in a locale, from Intl alone. The short name is an abbreviation (the reader's region's, else
 * the zone's own region's, in English only for Latin-script readers: "BST" for London), else its place, else its offset.
 */
export class TimeZoneName {
	/** How the locale writes a zone by its place ("{0} Time", "hora de {0}"), read off Japan, a one-zone country. */
	private static placePattern(locale: Intl.Locale) {
		const japan = new Intl.DisplayNames([locale], { type: 'region' }).of('JP') ?? ''
		const parts = TimeZoneName.part(locale, 'Asia/Tokyo', 'shortGeneric', new Date()).split(japan)
		return japan && parts.length === 2 ? parts as [string, string] : undefined
	}

	private static part(locale: Intl.Locale | string, id: string, style: Intl.DateTimeFormatOptions['timeZoneName'], at: Date) {
		return new Intl.DateTimeFormat(locale, { timeZone: id, timeZoneName: style }).formatToParts(at).find(part => part.type === 'timeZoneName')?.value ?? ''
	}

	constructor(readonly zone: TimeZone, private readonly locale: Intl.Locale, private readonly at = new Date()) { }

	private get id() {
		return this.zone.id
	}

	/** The offset as the locale writes it: "GMT+2", "UTC−3". */
	get offset() {
		return TimeZoneName.part(this.locale, this.id, 'shortOffset', this.at)
	}

	/** An abbreviation someone actually uses for the zone, if there is one. */
	get abbreviation(): string | undefined {
		const own = this.abbreviationIn(this.locale)
		const region = this.zone.region
		if (own || !region) {
			return own
		}
		const language = this.locale.language
		return this.abbreviationIn(`${language}-${region}`)
			?? (new Intl.Locale(language).maximize().script !== 'Latn' ? undefined : this.abbreviationIn(`en-${region}`))
	}

	private abbreviationIn(locale: Intl.Locale | string) {
		const short = TimeZoneName.part(locale, this.id, 'short', this.at)
		return short && short !== TimeZoneName.part(locale, this.id, 'shortOffset', this.at) ? short : undefined
	}

	/** Where the zone is, in the locale's words: its country where that has one zone, else its city. */
	get place(): string | undefined {
		const pattern = TimeZoneName.placePattern(this.locale)
		const generic = TimeZoneName.part(this.locale, this.id, 'shortGeneric', this.at)
		if (!pattern) {
			return undefined
		}
		const [before, after] = pattern
		return generic.length > before.length + after.length && generic.startsWith(before) && generic.endsWith(after)
			? generic.slice(before.length, generic.length - after.length)
			: undefined
	}

	/** The label of a column of hours. */
	get short() {
		return this.abbreviation ?? this.place ?? this.offset
	}

	/** Its name the year round ("Central European Time"), which the picker lists zones under. */
	get generic() {
		return TimeZoneName.part(this.locale, this.id, 'longGeneric', this.at)
	}

	/** Its name right now ("Central European Summer Time"). */
	get long() {
		return TimeZoneName.part(this.locale, this.id, 'long', this.at)
	}

	/** The city the zone is named after (`America/New_York` → "New York"); Intl has no translation of it everywhere. */
	get city() {
		return this.id.split('/').at(-1)!.replaceAll('_', ' ')
	}
}
