import ICAL from 'ical.js'
import { TimeZone } from '../../features/time/TimeZone.js'

/** The .ics boundary's times: the only place an `ICAL.Time` turns into an instant or back. */
export class IcsTime {
	/** Build a DTSTART/DTEND/DUE/EXDATE value (written as VALUE=DATE for all-day). */
	static toICALTime(date: Date, allDay: boolean) {
		if (!allDay) {
			return ICAL.Time.fromJSDate(date, true)
		}
		const { year, month, day } = TimeZone.UTC.dayOf(date)
		return ICAL.Time.fromData({ year, month, day, isDate: true })
	}

	/** Whether a parsed timed value is an RFC 5545 FLOATING time. */
	static isFloating(value: unknown): boolean {
		return value instanceof ICAL.Time && !value.isDate && value.zone === ICAL.Timezone.localTimezone
	}

	/** Whether Temporal can resolve a TZID as a valid IANA time zone. */
	static resolvableZone(tzid: string | null | undefined): tzid is string {
		try {
			return !!tzid && !!Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(tzid)
		} catch {
			return false
		}
	}

	/** Converts an iCalendar time object and optional TZID to a JavaScript Date. */
	static instantFrom(time: { isDate?: boolean, year: number, month: number, day: number, hour?: number, minute?: number, second?: number, toJSDate(): Date } | null | undefined, tzid?: string): Date | undefined {
		if (!time) {
			return undefined
		}
		if (time.isDate) {
			return TimeZone.UTC.midnightOf(Temporal.PlainDate.from({ year: time.year, month: time.month, day: time.day }))
		}
		if (IcsTime.resolvableZone(tzid)) {
			return new Date(Temporal.PlainDateTime
				.from({ year: time.year, month: time.month, day: time.day, hour: time.hour ?? 0, minute: time.minute ?? 0, second: time.second ?? 0 })
				.toZonedDateTime(tzid, { disambiguation: 'compatible' }).epochMilliseconds)
		}
		if (IcsTime.isFloating(time)) {
			return new Date(Date.UTC(time.year, time.month - 1, time.day, time.hour ?? 0, time.minute ?? 0, time.second ?? 0))
		}
		return time.toJSDate()
	}
}
