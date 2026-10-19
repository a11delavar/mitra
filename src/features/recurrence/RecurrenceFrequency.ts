import { Localizer } from '@3mo/localization'

export type RecurrenceFrequencyCode = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

/** How often a series repeats (RFC 5545 FREQ), one instance per frequency, so instances compare by identity. */
export class RecurrenceFrequency {
	static readonly Daily = new RecurrenceFrequency('DAILY', 'day', 1)
	static readonly Weekly = new RecurrenceFrequency('WEEKLY', 'week', 7)
	static readonly Monthly = new RecurrenceFrequency('MONTHLY', 'month', 30.436875)
	static readonly Yearly = new RecurrenceFrequency('YEARLY', 'year', 365.2425)

	static readonly all: ReadonlyArray<RecurrenceFrequency> = [RecurrenceFrequency.Daily, RecurrenceFrequency.Weekly, RecurrenceFrequency.Monthly, RecurrenceFrequency.Yearly]

	/** The frequency a stored, sent or RRULE value names, in any case. */
	static parse(value: unknown): RecurrenceFrequency | undefined {
		return value instanceof RecurrenceFrequency ? value
			: typeof value === 'string' ? RecurrenceFrequency.all.find(frequency => frequency.code === value.toUpperCase())
				: undefined
	}

	private constructor(
		readonly code: RecurrenceFrequencyCode,
		/** Its unit as Intl names it. */
		private readonly unit: 'day' | 'week' | 'month' | 'year',
		/** Its mean length in days, by Gregorian averages. */
		readonly days: number,
	) { }

	/** "Every week", "Every 2 weeks": one plural entry per unit, whose singular form is the interval-less phrase. */
	format(every = 1): string {
		switch (this) {
			case RecurrenceFrequency.Daily: return String(t('Every ${count:pluralityNumber} days', { count: every }))
			case RecurrenceFrequency.Weekly: return String(t('Every ${count:pluralityNumber} weeks', { count: every }))
			case RecurrenceFrequency.Monthly: return String(t('Every ${count:pluralityNumber} months', { count: every }))
			default: return String(t('Every ${count:pluralityNumber} years', { count: every }))
		}
	}

	/** The unit alone, as the number beside it asks for it ("Every [2] [weeks]"), in the language's own plural. */
	formatUnit(count: number, locale: Intl.LocalesArgument = Localizer.locales.current): string {
		return new Intl.NumberFormat(locale, { style: 'unit', unit: this.unit, unitDisplay: 'long' })
			.formatToParts(count)
			.filter(part => part.type === 'unit')
			.map(part => part.value)
			.join('')
	}

	toString() {
		return this.code
	}
}
