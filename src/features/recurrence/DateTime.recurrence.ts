import { DateTime } from '@3mo/date-time'
import { calendarDateOf } from '../time/calendarDate.js'

/*
	What a series asks of the moment it starts at, on DateTime itself until Mitra has a date class of its own. RFC 5545
	counts month days, a month's nth weekday and yearly dates in Gregorian months, whatever calendar the language reads:
	the 9th of Mehr is the 1st of October.
*/

declare module '@3mo/date-time' {
	interface DateTime {
		/** The date a series starting here repeats by, in ISO. */
		readonly recurrenceDate: Temporal.PlainDate
		/** That date as a yearly series names it, in Gregorian months ("Oct 1"). */
		formatAsAnniversary(): string
	}
}

Object.defineProperties(DateTime.prototype, {
	recurrenceDate: {
		get(this: DateTime) { return calendarDateOf(this, this.timeZone) },
	},
	formatAsAnniversary: {
		value(this: DateTime) { return this.format({ month: 'short', day: 'numeric', calendar: 'gregory' }) },
	},
})
