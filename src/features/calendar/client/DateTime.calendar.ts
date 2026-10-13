import { DateTime } from '@3mo/date-time'
import { calendarDateOf } from '../../time/calendarDate.js'

declare module '@3mo/date-time' {
	interface DateTime {
		/**
		 * The day as an address or a stored key writes it (`2026-10-09`): ISO, never the display calendar's numbers, as a
		 * Persian 1405-07-17 read back as a Gregorian day is six centuries off.
		 */
		readonly isoDate: string
	}
}

Object.defineProperties(DateTime.prototype, {
	isoDate: {
		get(this: DateTime) { return calendarDateOf(this, this.timeZone).toString() },
	},
})
