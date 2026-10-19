import { Localizer } from '@3mo/localization'
import { DateTime } from '@3mo/date-time'
import { TimeZone } from '../time/TimeZone.js'

/**
 * The last day a series runs (RFC 5545 UNTIL): a calendar day, stored as UTC midnight of it, whether it arrives as a
 * frontend `DateTime` or the backend's `Date`.
 */
export class RecurrenceEnd {
	static of(until: Date | DateTime): RecurrenceEnd {
		return new RecurrenceEnd(TimeZone.UTC.dayOf(until as Date))
	}

	/** The day before an instant: it ends a series just before that occurrence, its end of day keeping the one before. */
	static before(instant: Date): RecurrenceEnd {
		return new RecurrenceEnd(TimeZone.UTC.dayOf(instant).subtract({ days: 1 }))
	}

	/** The day an RRULE's UNTIL (`20261001`, `20261001T235959Z`), an ISO day or a stored or sent instant names. */
	static parse(value: unknown): RecurrenceEnd | undefined {
		if (value instanceof RecurrenceEnd) {
			return value
		}
		if (value instanceof Date) {
			return RecurrenceEnd.of(value)
		}
		const match = typeof value === 'string' ? /^(\d{4})-?(\d{2})-?(\d{2})/.exec(value) : null
		return !match ? undefined : new RecurrenceEnd(Temporal.PlainDate.from({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }))
	}

	/**
	 * The day as ISO writes it: plain data, as the API client `structuredClone`s request bodies, which a native Temporal
	 * object refuses, and the editor's dirty check compares deeply, which `PlainDate#valueOf` throws at.
	 */
	readonly isoDate: string

	constructor(date: Temporal.PlainDate) {
		this.isoDate = date.toString()
	}

	get date(): Temporal.PlainDate {
		return Temporal.PlainDate.from(this.isoDate)
	}

	/** UTC midnight of the day, as the column stores it and a date field in UTC shows it. */
	get instant(): DateTime {
		return new DateTime(`${this.isoDate}T00:00:00.000Z`)
	}

	/**
	 * As an RRULE writes it, matching DTSTART's value type: a date for an all-day series, else the day's last second in
	 * UTC, which counts the day's occurrence in zones at or ahead of UTC.
	 */
	toRRule(allDay: boolean) {
		const date = this.isoDate.replaceAll('-', '')
		return allDay ? date : `${date}T235959Z`
	}

	/** "Jul 18", as a series' label names its end. */
	format(locale: Intl.LocalesArgument = Localizer.locales.current) {
		return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(this.instant)
	}

	equals(other: RecurrenceEnd | undefined) {
		return !!other && this.isoDate === other.isoDate
	}

	toString() {
		return this.isoDate
	}
}
