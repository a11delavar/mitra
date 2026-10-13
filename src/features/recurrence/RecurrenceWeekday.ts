import { Localizer } from '@3mo/localization'
import { type Converter } from '@a11d/converter'
import { Type } from '../../infrastructure/model/orm.js'

export type RecurrenceWeekdayCode = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

/**
 * A day of the week as RFC 5545's BYDAY writes it (`MO`…`SU`), Monday first like Temporal's `dayOfWeek`, optionally the
 * nth of it in a month (`2MO`, the last being `-1TH`). The plain weekdays are one instance each, so they compare by identity.
 */
export class RecurrenceWeekday {
	static readonly Monday = new RecurrenceWeekday('MO', 1)
	static readonly Tuesday = new RecurrenceWeekday('TU', 2)
	static readonly Wednesday = new RecurrenceWeekday('WE', 3)
	static readonly Thursday = new RecurrenceWeekday('TH', 4)
	static readonly Friday = new RecurrenceWeekday('FR', 5)
	static readonly Saturday = new RecurrenceWeekday('SA', 6)
	static readonly Sunday = new RecurrenceWeekday('SU', 7)

	static readonly all: ReadonlyArray<RecurrenceWeekday> = [
		RecurrenceWeekday.Monday, RecurrenceWeekday.Tuesday, RecurrenceWeekday.Wednesday, RecurrenceWeekday.Thursday,
		RecurrenceWeekday.Friday, RecurrenceWeekday.Saturday, RecurrenceWeekday.Sunday,
	]

	/** The days of a week in the order `locale` runs it. */
	static week(locale: Intl.Locale = Localizer.locales.current): Array<RecurrenceWeekday> {
		const first = RecurrenceWeekday.of({ dayOfWeek: locale.getWeekInfo().firstDay })
		return RecurrenceWeekday.all.map((_, days) => first.plus(days))
	}

	/** The days `locale` works, its weekend left out (Saturday to Thursday in Persian). */
	static workdays(locale: Intl.Locale = Localizer.locales.current): Array<RecurrenceWeekday> {
		const { weekend } = locale.getWeekInfo()
		return RecurrenceWeekday.week(locale).filter(weekday => !weekend.includes(weekday.dayOfWeek))
	}

	static of(date: { readonly dayOfWeek: number }): RecurrenceWeekday {
		return RecurrenceWeekday.all[date.dayOfWeek - 1]!
	}

	/** The weekday a BYDAY part names, with its ordinal: `-1TH` is the last Thursday. */
	static parse(value: unknown): RecurrenceWeekday | undefined {
		if (value instanceof RecurrenceWeekday) {
			return value
		}
		const match = typeof value === 'string' ? /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(value.toUpperCase()) : null
		const weekday = match ? RecurrenceWeekday.all.find(weekday => weekday.code === match[2]) : undefined
		return match?.[1] ? weekday?.nth(Number(match[1])) : weekday
	}

	private constructor(
		readonly code: RecurrenceWeekdayCode,
		readonly dayOfWeek: number,
		/** Which of its kind in the month it is, counted from the end where negative. */
		readonly ordinal?: number,
	) { }

	/** The nth of this weekday in a month (-1 the last). */
	nth(ordinal: number): RecurrenceWeekday {
		return new RecurrenceWeekday(this.code, this.dayOfWeek, ordinal)
	}

	/** The weekday `days` later, or earlier where negative, keeping its ordinal. */
	plus(days: number): RecurrenceWeekday {
		const weekday = RecurrenceWeekday.all[((this.dayOfWeek - 1 + days) % 7 + 7) % 7]!
		return this.ordinal === undefined ? weekday : weekday.nth(this.ordinal)
	}

	equals(other: RecurrenceWeekday | undefined) {
		return !!other && this.code === other.code && this.ordinal === other.ordinal
	}

	/** Its short name ("Thu"), read off a reference week in UTC (2024-01-01 was a Monday), so no zone can shift the day. */
	format(locale: Intl.LocalesArgument = Localizer.locales.current) {
		return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2024, 0, this.dayOfWeek))
	}

	toString() {
		return `${this.ordinal ?? ''}${this.code}`
	}

	static readonly converter: Converter<Array<string> | undefined, Array<RecurrenceWeekday> | undefined> = {
		// An unknown code leaves a hole, which `Recurrence.valid` refuses.
		construct: value => value?.map(code => RecurrenceWeekday.parse(code)!),
		deconstruct: value => value?.map(String),
	}

	static readonly Mapper = class extends Type<Array<RecurrenceWeekday> | undefined, string | null> {
		override convertToDatabaseValue(value: Array<RecurrenceWeekday> | null | undefined): string | null {
			return value ? JSON.stringify(value.map(String)) : null
		}

		override convertToJSValue(value: unknown): Array<RecurrenceWeekday> | undefined {
			const codes: unknown = typeof value === 'string' ? JSON.parse(value) : value
			return codes instanceof Array ? codes.map(code => RecurrenceWeekday.parse(code)!) : undefined
		}

		override getColumnType(): string {
			return 'json'
		}
	}
}
