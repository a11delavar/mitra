import { DateTime } from '@3mo/date-time'
import { TimeZone } from '#features/time/TimeZone.js'
import { RecurrenceWeekday } from './RecurrenceWeekday.js'

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
		/** The first day from here on that falls on one of `days`, where a recurrence on them first occurs: RFC 5545 counts the start as an occurrence whatever BYDAY says. */
		firstOccurrenceOn(days: ReadonlyArray<RecurrenceWeekday>): DateTime
	}
}

Object.defineProperties(DateTime.prototype, {
	recurrenceDate: {
		get(this: DateTime) { return TimeZone.of(this.timeZone).dayOf(this) },
	},
	formatAsAnniversary: {
		value(this: DateTime) { return this.format({ month: 'short', day: 'numeric', calendar: 'gregory' }) },
	},
	firstOccurrenceOn: {
		value(this: DateTime, days: ReadonlyArray<RecurrenceWeekday>) {
			const week = Array.from({ length: this.daysInWeek }, (_, offset) => this.dayStart.add({ days: offset }))
			return week.find(day => days.includes(RecurrenceWeekday.of(day))) ?? this.dayStart
		},
	},
})
