import { DateTime } from '@3mo/date-time'
import { Localizer } from '@3mo/localization'
import { converter } from '@a11d/converter'
import { model } from '../../infrastructure/model/model.js'
import { Type } from '@mikro-orm/core'
import { RecurrenceEnd } from './RecurrenceEnd.js'
import { RecurrenceFrequency } from './RecurrenceFrequency.js'
import { RecurrenceWeekday } from './RecurrenceWeekday.js'
import './DateTime.recurrence.js'

export interface RecurrencePreset {
	readonly id: string
	readonly label: string
	readonly detail?: string
	readonly recurrence?: Recurrence
}

/**
 * A recurring entry's rule (RFC 5545 RRULE) by the parts Mitra edits, the others kept as written. Kept free of ical.js,
 * so it bundles into the frontend.
 */
@model('Recurrence')
export class Recurrence {
	@converter(RecurrenceFrequency.converter) freq!: RecurrenceFrequency
	interval?: number
	@converter(RecurrenceWeekday.converter) byday?: Array<RecurrenceWeekday>
	bymonthday?: number
	count?: number
	@converter(RecurrenceEnd.converter) until?: RecurrenceEnd
	/** The parts Mitra doesn't edit (`BYSETPOS=-1`, `BYMONTH=5`, several month days), as the rule wrote them. */
	rest?: string

	constructor(init?: Partial<Recurrence>) {
		Object.assign(this, init)
	}

	get every(): number {
		return this.interval && this.interval > 1 ? this.interval : 1
	}

	/** Mean days between occurrences, a weekly BYDAY list dividing the week. */
	get strideDays(): number {
		const unit = this.freq?.days
		if (!unit) {
			return Infinity
		}
		const perUnit = this.freq === RecurrenceFrequency.Weekly ? Math.max(1, this.byday?.length ?? 1) : 1
		return unit * this.every / perUnit
	}

	with(patch: Partial<Recurrence>): Recurrence {
		return new Recurrence({ ...this, ...patch })
	}

	/** Without the `RRULE:` prefix. */
	toRRule(allDay = false): string {
		const parts = [`FREQ=${this.freq}`]
		if (this.every > 1) {
			parts.push(`INTERVAL=${this.every}`)
		}
		if (this.byday?.length) {
			parts.push(`BYDAY=${this.byday.join(',')}`)
		}
		if (this.bymonthday) {
			parts.push(`BYMONTHDAY=${this.bymonthday}`)
		}
		if (this.count) {
			parts.push(`COUNT=${this.count}`)
		} else if (this.until) {
			parts.push(`UNTIL=${this.until.toRRule(allDay)}`)
		}
		if (this.rest) {
			parts.push(this.rest)
		}
		return parts.join(';')
	}

	/** Two missing rules are the same rule. */
	static equal(a: Recurrence | null | undefined, b: Recurrence | null | undefined): boolean {
		return a ? a.equals(b) : !b
	}

	/** Whether ical.js can iterate it. */
	get valid(): boolean {
		const absent = (value: unknown) => value === undefined || value === null
		return this.freq instanceof RecurrenceFrequency
			&& (absent(this.interval) || (Number.isInteger(this.interval) && this.interval! >= 1))
			&& (this.byday ?? []).every(weekday => weekday instanceof RecurrenceWeekday)
			&& (absent(this.bymonthday) || (Number.isInteger(this.bymonthday) && this.bymonthday! >= 1 && this.bymonthday! <= 31))
			&& (absent(this.count) || (Number.isInteger(this.count) && this.count! >= 1))
			&& (absent(this.rest) || (typeof this.rest === 'string' && /^[A-Z-]+=[^;=]+(;[A-Z-]+=[^;=]+)*$/.test(this.rest)))
	}

	equals(other?: Recurrence | null): boolean {
		if (!other) {
			return false
		}
		return this.freq === other.freq
			&& this.every === other.every
			&& (this.bymonthday ?? null) === (other.bymonthday ?? null)
			&& (this.count ?? null) === (other.count ?? null)
			&& (this.byday ?? []).map(String).sort().join(',') === (other.byday ?? []).map(String).sort().join(',')
			&& (this.until?.toString() ?? null) === (other.until?.toString() ?? null)
			&& (this.rest ?? null) === (other.rest ?? null)
	}

	/** "Every week on Thu until Jul 18". */
	describe(start?: DateTime): string {
		const frequency = this.freq.format(this.every)
		let rule: string
		switch (this.freq) {
			case RecurrenceFrequency.Weekly: {
				const workdays = RecurrenceWeekday.workdays()
				const onWorkdays = this.byday?.length === workdays.length && workdays.every(weekday => this.byday!.includes(weekday))
				rule = onWorkdays && this.every === 1 ? t('Every weekday')
					: !this.byday?.length ? frequency
						: `${frequency} ${t('on ${weekday}', { weekday: this.byday.map(weekday => weekday.format()).format() })}`
				break
			}
			case RecurrenceFrequency.Monthly: {
				const on = this.bymonthday ? Recurrence.monthDayLabel(this.bymonthday)
					: this.byday?.length === 1 ? Recurrence.monthWeekdayLabel(this.byday[0]!)
						: undefined
				rule = on ? `${frequency} ${on}` : frequency
				break
			}
			case RecurrenceFrequency.Yearly:
				rule = this.every === 1 && start ? `${frequency} ${t('on ${date}', { date: start.formatAsAnniversary() })}` : frequency
				break
			default:
				rule = frequency
		}
		if (this.rest) {
			rule = String(t('Repeats'))
		}
		return String(this.count ? t('${rule}, ${count:pluralityNumber} times', { rule, count: this.count })
			: this.until ? t('${rule} until ${date}', { rule, date: this.until.format() })
				: rule)
	}

	/** `undefined` for a rule Mitra doesn't model. */
	static fromRRule(rrule: string | undefined): Recurrence | undefined {
		if (!rrule) {
			return undefined
		}
		const parts: Record<string, string> = {}
		for (const segment of rrule.replace(/^RRULE:/i, '').split(';')) {
			const [key, value] = segment.split('=')
			if (key && value !== undefined) {
				parts[key.toUpperCase()] = value
			}
		}
		const freq = RecurrenceFrequency.parse(parts.FREQ)
		if (!freq) {
			return undefined
		}
		const recurrence = new Recurrence({ freq })
		const interval = Math.max(1, Math.trunc(Number(parts.INTERVAL ?? 1)) || 1)
		recurrence.interval = interval > 1 ? interval : undefined
		if (parts.BYDAY) {
			const byday = parts.BYDAY.split(',').map(code => code.trim()).filter(Boolean).map(RecurrenceWeekday.parse)
			if (!byday.every(weekday => weekday !== undefined)) {
				return undefined
			}
			recurrence.byday = byday
		}
		if (parts.BYMONTHDAY && /^\d+$/.test(parts.BYMONTHDAY)) {
			recurrence.bymonthday = Number(parts.BYMONTHDAY)
			delete parts.BYMONTHDAY
		}
		if (parts.COUNT) {
			recurrence.count = Math.max(1, Math.trunc(Number(parts.COUNT)) || 1)
		} else if (parts.UNTIL) {
			recurrence.until = RecurrenceEnd.parse(parts.UNTIL)
		}
		const rest = Object.entries(parts).filter(([key]) => !Recurrence.edited.has(key)).map(([key, value]) => `${key}=${value}`)
		recurrence.rest = rest.length ? rest.join(';') : undefined
		return recurrence
	}

	/** The rule a request body carries, judged by {@link valid}, so a malformed one is refused rather than dropped. */
	static from(data: Partial<Recurrence> | undefined | null): Recurrence | undefined {
		if (!data) {
			return undefined
		}
		return new Recurrence({
			// An unknown frequency or weekday leaves a hole, which `valid` refuses: the server's reviver has already turned
			// an unknown code into none, so a rule without one is still a rule, and a malformed one.
			freq: RecurrenceFrequency.parse(data.freq)!,
			interval: data.interval,
			byday: data.byday?.map(weekday => RecurrenceWeekday.parse(weekday)!),
			bymonthday: data.bymonthday,
			count: data.count,
			until: RecurrenceEnd.parse(data.until),
			rest: data.rest || undefined,
		})
	}

	/** A month day reads as one only when it is one; a list stays in `rest`. */
	private static readonly edited = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL'])

	/** The rule as its RRULE, so the column holds what a calendar would read. */
	static readonly Mapper = class extends Type<Recurrence | undefined, string | null> {
		override convertToDatabaseValue(value: Recurrence | null | undefined): string | null {
			return value?.toRRule() ?? null
		}

		override convertToJSValue(value: unknown): Recurrence | undefined {
			return typeof value === 'string' ? Recurrence.fromRRule(value) : undefined
		}

		override getColumnType(): string {
			return 'text'
		}
	}

	static presets(start: DateTime): Array<RecurrencePreset> {
		const weekday = RecurrenceWeekday.of(start)
		const workdays = RecurrenceWeekday.workdays()
		const on = String(t('on ${weekday}', { weekday: weekday.format() }))
		const day = start.recurrenceDate
		const dayOfMonth = day.day
		const weekOfMonth = Math.floor((dayOfMonth - 1) / 7) + 1
		const isLastWeekdayOfMonth = dayOfMonth + 7 > day.daysInMonth
		return [
			{ id: 'none', label: String(t('Does not repeat')) },
			{ id: 'daily', label: RecurrenceFrequency.Daily.format(), recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) },
			{ id: 'weekday', label: String(t('Every weekday')), detail: `${workdays[0]!.format()} – ${workdays.at(-1)!.format()}`, recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: workdays }) },
			{ id: 'weekly', label: RecurrenceFrequency.Weekly.format(), detail: on, recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [weekday] }) },
			{ id: 'biweekly', label: RecurrenceFrequency.Weekly.format(2), detail: on, recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 2, byday: [weekday] }) },
			{ id: 'monthly-day', label: RecurrenceFrequency.Monthly.format(), detail: Recurrence.monthDayLabel(dayOfMonth), recurrence: new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: dayOfMonth }) },
			{ id: 'monthly-weekday', label: RecurrenceFrequency.Monthly.format(), detail: Recurrence.monthWeekdayLabel(weekday.nth(weekOfMonth)), recurrence: new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [weekday.nth(weekOfMonth)] }) },
			...(isLastWeekdayOfMonth ? [{ id: 'monthly-last', label: RecurrenceFrequency.Monthly.format(), detail: Recurrence.monthWeekdayLabel(weekday.nth(-1)), recurrence: new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [weekday.nth(-1)] }) }] : []),
			{ id: 'yearly', label: RecurrenceFrequency.Yearly.format(), detail: String(t('on ${date}', { date: start.formatAsAnniversary() })), recurrence: new Recurrence({ freq: RecurrenceFrequency.Yearly }) },
		]
	}

	static defaultFor(start: DateTime): Recurrence {
		return new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.of(start)] })
	}

	static matchedPresetId(presets: ReadonlyArray<RecurrencePreset>, recurrence?: Recurrence | null): string | undefined {
		if (!recurrence) {
			return 'none'
		}
		return presets.find(preset => preset.recurrence?.equals(recurrence))?.id
	}

	/** "on the 25th" */
	static monthDayLabel(day: number): string {
		return String(t('on the ${ordinal}', { ordinal: Recurrence.ordinal(day) }))
	}

	/** "on the 4th Thu", "on the last Thu" */
	static monthWeekdayLabel(weekday: RecurrenceWeekday): string {
		// Without an ordinal, a monthly BYDAY is every such day of the month.
		return String(weekday.ordinal === undefined ? t('on ${weekday}', { weekday: weekday.format() })
			: weekday.ordinal === -1 ? t('on the last ${weekday}', { weekday: weekday.format() })
				: t('on the ${ordinal} ${weekday}', { ordinal: Recurrence.ordinal(weekday.ordinal), weekday: weekday.format() }))
	}

	/** "21st": Intl picks the language's ordinal category, the dictionary its form (German "25.", French "1er"). */
	static ordinal(n: number): string {
		switch (new Intl.PluralRules(Localizer.locales.current, { type: 'ordinal' }).select(n)) {
			case 'one': return String(t('${n:number}st', { n }))
			case 'two': return String(t('${n:number}nd', { n }))
			case 'few': return String(t('${n:number}rd', { n }))
			default: return String(t('${n:number}th', { n }))
		}
	}

	/**
	 * The rule once its anchor moves from one day to another: weekdays rotate and a month day follows, as a rule that
	 * misses its anchor loses every occurrence before its first match. The caller reads each day where it stands, as a
	 * move between all-day and timed puts them in different frames.
	 */
	rebased(from: Temporal.PlainDate, to: Temporal.PlainDate): Recurrence {
		const deltaDays = to.since(from).days
		if (deltaDays === 0) {
			return this
		}
		const patch: Partial<Recurrence> = {}
		if (this.byday?.length) {
			patch.byday = this.byday.map(weekday => weekday.plus(deltaDays))
		}
		if (this.bymonthday) {
			patch.bymonthday = to.day
		}
		return this.with(patch)
	}

	/** The half of a split that ends before `recurrenceId`. */
	endingBefore(recurrenceId: Date): Recurrence {
		return this.with({ until: RecurrenceEnd.before(recurrenceId), count: undefined })
	}

	/** The half of a split that continues, a COUNT carrying what the old half didn't consume. */
	asContinuation(consumed = 0): Recurrence {
		return this.with({ count: this.count ? Math.max(1, this.count - consumed) : undefined })
	}
}
