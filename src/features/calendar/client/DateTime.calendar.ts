import { DateTime } from '@3mo/date-time'
import { TimeZone } from '#features/time/TimeZone.js'

declare module '@3mo/date-time' {
	interface DateTime {
		/**
		 * The day as an address or a stored key writes it (`2026-10-09`): ISO, never the display calendar's numbers, as a
		 * Persian 1405-07-17 read back as a Gregorian day is six centuries off.
		 */
		readonly isoDate: string
		/**
		 * Itself in the fewest words that tell it apart from `day`: its time on that day (nothing when not `timed`), its weekday
		 * within the week ahead, else its date, with the year only where it differs. A weekday never looks back: "Fri" seen from
		 * a Tuesday reads as the Friday to come.
		 */
		formatAsSeenFrom(day: DateTime, timed: boolean): string | undefined
	}
}

Object.defineProperties(DateTime.prototype, {
	isoDate: {
		get(this: DateTime) { return TimeZone.of(this.timeZone).dayOf(this).toString() },
	},
	formatAsSeenFrom: {
		value(this: DateTime, day: DateTime, timed: boolean) {
			const from = day.dayStart
			if (this.dayStart.equals(from)) {
				return !timed ? undefined : this.format({ timeStyle: 'short' })
			}
			return this.isAfter(from) && this.isBefore(from.add({ days: from.daysInWeek }))
				? this.format({ weekday: 'short' })
				: this.format({ day: 'numeric', month: 'short', ...this.year === from.year ? {} : { year: 'numeric' } })
		},
	},
})
