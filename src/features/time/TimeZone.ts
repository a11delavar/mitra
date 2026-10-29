import { Memoize as memoize } from 'typescript-memoize'
import { z } from 'zod'
import { Type } from '#infrastructure/model'
import { ValidationError } from '#infrastructure/validation'
import { TimeZoneName } from './TimeZoneName.js'
import goldenZones from './goldenZones.json' with { type: 'json' }

/** The device's zone as last asked, with the offset it had then. */
let device: { readonly offset: number, readonly id: string } | undefined
let watchingPage = false

/**
 * An IANA time zone, as the platform has only ids (Temporal dropped `TimeZone` in 2024): one instance per zone, its
 * aliases included (`Asia/Calcutta` is `Asia/Kolkata`), which engines spell differently.
 */
export class TimeZone {
	/** The zone with that id. Throws a `RangeError` for one the runtime does not know. */
	static of(id: string): TimeZone {
		return TimeZone.spelled(id.toLowerCase())
	}

	// Keyed lowercased, so a request cannot grow the cache with every casing of an id.
	@memoize()
	private static spelled(id: string): TimeZone {
		// Intl refuses an unknown zone and spells a known one its own way ("asia/tokyo" is "Asia/Tokyo"). Not Temporal,
		// whose native engines merge zones that CLDR keeps apart (Oslo is Berlin there), unlike its polyfill.
		const spelled = new Intl.DateTimeFormat('en', { timeZone: id }).resolvedOptions().timeZone
		return spelled.toLowerCase() === id ? new TimeZone(spelled) : TimeZone.of(spelled)
	}

	/**
	 * The id of the zone this device runs in, kept until its offset changes or the page shows again: Intl answers slowly
	 * (50 µs), the offset quickly (0.15 µs).
	 */
	static get deviceId(): string {
		const offset = new Date().getTimezoneOffset()
		if (device?.offset !== offset) {
			if (!watchingPage) {
				watchingPage = true
				// A trip takes effect when the device is picked up again; the offset catches the ones that move the clock while it
				// is open. Listened for on the first read, not at load: a split bundle runs a shared chunk before the importing
				// file's own code, so a page a test installs is not there yet.
				globalThis.document?.addEventListener('visibilitychange', () => device = undefined)
			}
			device = { offset, id: Intl.DateTimeFormat().resolvedOptions().timeZone }
		}
		return device.id
	}

	static get default() {
		return TimeZone.UTC
	}

	/**
	 * Where this runtime holds what has no zone of its own, an all-day date and a floating time (RFC 5545's local date and time):
	 * the device's in the browser; none on the server, which keeps them as stored.
	 */
	static get local(): TimeZone | undefined {
		return mitra.runtime === 'browser' ? TimeZone.device : undefined
	}

	static get localOrDefault() {
		return TimeZone.local ?? TimeZone.default
	}

	static get UTC() {
		return TimeZone.of('UTC')
	}

	/** The zone this device runs in: the browser's, or the server process's. Intl names one it cannot tell `Etc/Unknown`. */
	static get device() {
		return TimeZone.parse(TimeZone.deviceId) ?? TimeZone.UTC
	}

	/** A zone as a request names it, by its IANA id, refused where Mitra knows none by that id. */
	static readonly converter = {
		schema: z.string(),
		construct(value: string | undefined) {
			const zone = value === undefined ? undefined : TimeZone.parse(value)
			if (!zone && value !== undefined) {
				throw new ValidationError(`"${value}" is not a time zone. Name an IANA zone (Europe/Berlin).`, ['id'])
			}
			return zone
		},
		deconstruct: (zone: TimeZone | undefined) => zone?.id,
	}

	/** Keeps a zone as its id; one the platform no longer knows reads as none. */
	static readonly Mapper = class extends Type<TimeZone | undefined, string | null> {
		override convertToDatabaseValue(value: TimeZone | string | null | undefined) {
			return TimeZone.parse(value)?.id ?? null
		}

		override convertToJSValue(value: TimeZone | string | null | undefined) {
			return TimeZone.parse(value)
		}

		override getColumnType() {
			return 'text'
		}
	}

	static parse(value: unknown): TimeZone | undefined {
		if (value instanceof TimeZone) {
			return value
		}
		try {
			return typeof value === 'string' && value ? TimeZone.of(value) : undefined
		} catch {
			return undefined
		}
	}

	private constructor(readonly id: string) { }

	equals(other: TimeZone) {
		return this === other
	}

	/** The day `instant` falls on here. Never spread the `PlainDate`: its fields are prototype getters. */
	dayOf(instant: Date): Temporal.PlainDate {
		return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(this.id).toPlainDate()
	}

	/** The instant `day` begins here: its midnight, or its first wall-clock time where a DST jump skips midnight. */
	midnightOf(day: Temporal.PlainDate): Date {
		return new Date(day.toZonedDateTime(this.id).epochMilliseconds)
	}

	/** `instant` moved by the wall-clock distance from `from` to `to` here, so 09:00 stays 09:00 across a DST change. */
	shift(instant: Date, from: Date, to: Date): Date {
		const wall = (value: Date) => Temporal.Instant.fromEpochMilliseconds(value.getTime()).toZonedDateTimeISO(this.id).toPlainDateTime()
		const distance = wall(from).until(wall(to))
		return new Date(wall(instant).add(distance).toZonedDateTime(this.id, { disambiguation: 'compatible' }).epochMilliseconds)
	}

	/** The instant whose wall clock here reads what `instant`'s does in `elsewhere`: a floating time, held in one zone and read in another. */
	atWallClockOf(instant: Date, elsewhere: TimeZone) {
		const wall = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(elsewhere.id).toPlainDateTime()
		return new Date(wall.toZonedDateTime(this.id, { disambiguation: 'compatible' }).epochMilliseconds)
	}

	/** `instant` moved by `duration` on the wall clock here, so a week after 09:00 is 09:00 whatever the clock did between. */
	add(instant: Date, ...duration: Parameters<Temporal.ZonedDateTime['add']>): Date {
		return new Date(Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(this.id).add(...duration).epochMilliseconds)
	}

	/** Minutes ahead of UTC at `at`. */
	offsetAt(at = new Date()) {
		return Temporal.Instant.fromEpochMilliseconds(at.getTime()).toZonedDateTimeISO(this.id).offsetNanoseconds / 60_000_000_000
	}

	/**
	 * Its offsets in mid-January and mid-July, which differ where it keeps daylight saving in either hemisphere: Berlin
	 * and Algiers share January's, but only Berlin moves its clock.
	 */
	get yearlyOffsets(): readonly [number, number] {
		const year = new Date().getUTCFullYear()
		return [this.offsetAt(new Date(Date.UTC(year, 0, 15))), this.offsetAt(new Date(Date.UTC(year, 6, 15)))]
	}

	/** The default `locale` is the browser app's; the server must pass one. */
	name(locale = Localizer.locales.current, at = new Date()) {
		return new TimeZoneName(this, locale, at)
	}

	/**
	 * The region the zone belongs to (`Europe/London` is `GB`). Intl lists a region's zones, not a zone's region, so
	 * every region is asked once; an alias the list spells differently is matched by `equals`.
	 */
	@memoize()
	get region(): string | undefined {
		const regions = TimeZone.regionsByZone
		return regions.get(this.id) ?? [...regions].find(([id]) => TimeZone.parse(id)?.equals(this))?.[1]
	}

	@memoize()
	private static get regionsByZone() {
		const regions = new Map<string, string>()
		if (typeof Intl.Locale.prototype.getTimeZones !== 'function') {
			return regions
		}
		const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
		// Asking only codes that name a region costs a third of asking all 676.
		const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
		for (const code of letters.flatMap(first => letters.map(second => first + second)).filter(code => names.of(code))) {
			// An old code canonicalizes to the current one (UK to GB), which is the one to keep.
			const locale = new Intl.Locale(`und-${code}`)
			for (const id of locale.getTimeZones?.() ?? []) {
				regions.set(id, locale.region ?? code)
			}
		}
		return regions
	}

	/**
	 * Whether Unicode's data names a time after this zone in `region`, or worldwide without one: Eastern Time is New
	 * York's, and Toronto's in Canada. Intl does not expose it; `npm run zones:generate` copies it from CLDR.
	 */
	isGoldenIn(region = '001') {
		return (goldenZones as Record<string, ReadonlyArray<string> | undefined>)[region]?.includes(this.id) ?? false
	}

	toString() {
		return this.id
	}

	toJSON() {
		return this.id
	}
}

declare global {
	namespace Intl {
		interface Locale {
			/** The zones of the locale's region (Intl Locale Info: Chromium 130, Safari 17, Firefox 153). */
			getTimeZones?(): Array<string> | undefined
		}
	}
}
