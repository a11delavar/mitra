import { TimeSpan } from '@3mo/date-time'

/* How Mitra names a span it offers as a choice: a reminder's lead, a snap step, a default duration. */

declare module '@3mo/date-time' {
	interface TimeSpan {
		/** "30 min", "2 hours", "1 week": in the largest unit it fills whole. `localize` is `t` in a reader's language on the server. */
		formatAsWholeUnit(localize?: typeof t): string
	}
}

Object.defineProperty(TimeSpan.prototype, 'formatAsWholeUnit', {
	value(this: TimeSpan, localize: typeof t = t) {
		const minutes = Math.round(this.minutes)
		const units = [
			[7 * 24 * 60, (count: number) => localize('${count:pluralityNumber} weeks', { count })],
			[24 * 60, (count: number) => localize('${count:pluralityNumber} days', { count })],
			[60, (count: number) => localize('${count:pluralityNumber} hours', { count })],
		] as const
		const unit = units.find(([size]) => minutes >= size && minutes % size === 0)
		return unit ? unit[1](minutes / unit[0]) : localize('${count:number} min', { count: minutes })
	},
})
