import { DateTime } from '@3mo/date-time'
import { model } from '../../infrastructure/model/model.js'
import { embeddable, property } from '../../infrastructure/model/orm.js'
import { calendarDateOf } from '../time/calendarDate.js'

/**
 * The recurrence rule of a series, as an intrinsic DDD value object: the rule parts (FREQ/INTERVAL/BYDAY/
 * BYMONTHDAY/COUNT/UNTIL), not a stringly-typed `rrule`. It is the single source of truth for authoring (the
 * Repeat UI), .ics round-tripping (`toRRule`/`fromRRule`), expansion, and persistence: a MikroORM embeddable
 * mapped onto `Entry` as `recurrence_*` columns. Kept free of `ical.js` so it bundles into the frontend; the
 * backend converts to/from the .ics RRULE string at the edges. As a value object it is immutable in spirit:
 * edits go through `with(...)`, which returns a new instance.
 */
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

/** Which occurrences a recurring-series edit/delete applies to (RFC 5545 editing scopes). */
export type RecurrenceScope = 'this' | 'following' | 'all'

export interface RecurrencePreset {
	readonly id: string
	readonly label: string
	readonly detail?: string
	/** The rule this preset sets; absent for "Does not repeat". */
	readonly recurrence?: Recurrence
}

const FREQUENCIES: ReadonlyArray<Frequency> = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
/** RRULE weekday codes in RFC 5545 / Temporal order (Monday-first; Temporal `dayOfWeek` is 1=Mon … 7=Sun). */
export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
const WEEKDAY_SET: ReadonlySet<string> = new Set(['MO', 'TU', 'WE', 'TH', 'FR'])
/** Mean length of one FREQ unit in days (Gregorian averages, see {@link Recurrence.strideDays}). */
const DAYS_PER_FREQUENCY: Record<Frequency, number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 30.436875, YEARLY: 365.2425 }
function pad(value: number, width = 2) {
	return String(value).padStart(width, '0')
}

/** The UI language when the localization runtime is present (the frontend); node (tests, backend logs)
 * pins to `en` so label output stays deterministic there. (Try/catch, not just a typeof guard: the
 * Localizer global exists wherever the module is bundled, but its `current` getter dereferences
 * `window`, which only the browser has.) */
function language(): string {
	try {
		return typeof Localizer === 'undefined' ? 'en' : String(Localizer.locales.current)
	} catch {
		return 'en'
	}
}

/** Weekday/month names come from Intl, not hardcoded tables: a reference week (2024-01-01 was a
 * Monday) indexed by the RFC weekday order. Formatted as zone-less `PlainDate`s, so no timezone can
 * shift the day (the reason this once needed a noon-UTC trick on `Date`). */
function weekdayName(index: number): string {
	return Temporal.PlainDate.from({ year: 2024, month: 1, day: 1 + index }).toLocaleString(language(), { weekday: 'short' })
}

function monthDayName(date: Temporal.PlainDate): string {
	return date.toLocaleString(language(), { month: 'short', day: 'numeric' })
}

// UNTIL is a calendar day, stored as UTC midnight: its date is the instant's UTC reading, whether
// `until` arrives as a frontend DateTime or the backend's plain Date.
function untilParts(until: DateTime): Temporal.PlainDate {
	return calendarDateOf(until as unknown as Date, 'UTC')
}

// RFC 5545 UNTIL must match DTSTART's value type: a DATE for all-day, else an end-of-day UTC DATE-TIME so the
// chosen day's occurrence is included whatever its clock time (in zones at/ahead of UTC, the common case).
function formatUntil(until: DateTime, allDay: boolean): string {
	const { year, month, day } = untilParts(until)
	const date = `${pad(year, 4)}${pad(month)}${pad(day)}`
	return allDay ? date : `${date}T235959Z`
}

@model('Recurrence')
@embeddable()
export class Recurrence {
	// Neither field initialisers NOR constructor defaults: MikroORM instantiates `new Recurrence()` to detect
	// column defaults, and a non-null default would fill recurrence_* for *every* row and break the "has a
	// rule" (recurrence_freq IS NULL) query. So a bare instance has all-undefined columns; an entry with no
	// rule keeps them NULL. `freq` is always set by the factories (presets / fromRRule / defaultFor / with);
	// `interval` is optional and read as `interval ?? 1` everywhere (1 is the implied default, never stored).
	@property({ type: 'string', nullable: true }) freq!: Frequency
	@property({ type: 'integer', nullable: true }) interval?: number
	@property({ type: 'json', nullable: true }) byday?: Array<string>
	@property({ type: 'integer', nullable: true }) bymonthday?: number
	@property({ type: 'integer', nullable: true }) count?: number
	@property({ type: 'datetime', nullable: true }) until?: DateTime

	constructor(init?: Partial<Recurrence>) {
		Object.assign(this, init)
	}

	/** The effective interval (≥ 1); `undefined`/0/1 all mean "every 1". */
	get every(): number {
		return this.interval && this.interval > 1 ? this.interval : 1
	}

	/** Mean days between occurrences (Gregorian averages; a BYDAY list divides the weekly stride).
	 * `Infinity` when no frequency is modelled. */
	get strideDays(): number {
		const unit = DAYS_PER_FREQUENCY[this.freq]
		if (!unit) {
			return Infinity
		}
		const perUnit = this.freq === 'WEEKLY' ? Math.max(1, this.byday?.length ?? 1) : 1
		return unit * this.every / perUnit
	}

	/** An immutable edit: a new `Recurrence` with `patch` applied (drives the Custom dialog). */
	with(patch: Partial<Recurrence>): Recurrence {
		return new Recurrence({ ...this, ...patch })
	}

	/** Serialise to an RRULE string (no leading "RRULE:"). `allDay` selects the UNTIL value type. */
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
			parts.push(`UNTIL=${formatUntil(this.until, allDay)}`)
		}
		return parts.join(';')
	}

	/** Value equality that tolerates absence on either side: two missing rules are the same rule.
	 * The absence-safe form of {@link equals} for call sites holding `Recurrence | null | undefined`. */
	static equal(a: Recurrence | null | undefined, b: Recurrence | null | undefined): boolean {
		return a ? a.equals(b) : !b
	}

	/** Whether the rule is well-formed enough to serialise and iterate. The routes 400 on anything
	 * else before it can reach an .ics writer. A value object owns its own validity; no ical.js needed:
	 * everything this accepts serialises to an RRULE ical.js parses. Absent parts may be `undefined`
	 * (fresh instances) or `null` (nullable columns hydrated from the database), both mean "not set". */
	get valid(): boolean {
		const absent = (value: number | null | undefined) => value === undefined || value === null
		return FREQUENCIES.includes(this.freq)
			&& (absent(this.interval) || (Number.isInteger(this.interval) && this.interval! >= 1))
			&& (this.byday ?? []).every(code => /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.test(code))
			&& (absent(this.bymonthday) || (Number.isInteger(this.bymonthday) && this.bymonthday! >= 1 && this.bymonthday! <= 31))
			&& (absent(this.count) || (Number.isInteger(this.count) && this.count! >= 1))
	}

	/** Structural equality (order-insensitive byday; UNTIL compared by day). */
	equals(other?: Recurrence | null): boolean {
		if (!other) {
			return false
		}
		const day = (value?: DateTime) => value ? untilParts(value).toString() : null
		return this.freq === other.freq
			&& this.every === other.every
			&& (this.bymonthday ?? null) === (other.bymonthday ?? null)
			&& (this.count ?? null) === (other.count ?? null)
			&& [...(this.byday ?? [])].sort().join(',') === [...(other.byday ?? [])].sort().join(',')
			&& day(this.until) === day(other.until)
	}

	/** Human label, e.g. "Every week on Thu until Jul 18". `start` lets a yearly rule name its date. */
	describe(start?: DateTime): string {
		const frequency = Recurrence.frequencyLabel(this.freq, this.every)
		let rule: string
		switch (this.freq) {
			case 'WEEKLY': {
				const weekdays = this.byday?.length === WEEKDAY_SET.size && this.byday.every(code => WEEKDAY_SET.has(code))
				rule = weekdays && this.every === 1 ? t('Every weekday')
					: !this.byday?.length ? frequency
						: `${frequency} ${t('on ${weekday}', { weekday: this.byday.map(Recurrence.weekdayLabel).format() })}`
				break
			}
			case 'MONTHLY': {
				const on = this.bymonthday ? Recurrence.monthDayLabel(this.bymonthday)
					: this.byday?.length === 1 ? Recurrence.monthWeekdayLabel(this.byday[0]!)
						: undefined
				rule = on ? `${frequency} ${on}` : frequency
				break
			}
			case 'YEARLY':
				rule = this.every === 1 && start ? `${frequency} ${t('on ${date}', { date: start.format({ month: 'short', day: 'numeric' }) })}` : frequency
				break
			default:
				rule = frequency
		}
		return String(this.count ? t('${rule}, ${count:pluralityNumber} times', { rule, count: this.count })
			: this.until ? t('${rule} until ${date}', { rule, date: monthDayName(untilParts(this.until)) })
				: rule)
	}

	/** Parse an RRULE string (tolerant of a leading `RRULE:` and part order); `undefined` if not modelled. */
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
		const freq = parts.FREQ?.toUpperCase() as Frequency | undefined
		if (!freq || !FREQUENCIES.includes(freq)) {
			return undefined
		}
		const recurrence = new Recurrence({ freq })
		const interval = Math.max(1, Math.trunc(Number(parts.INTERVAL ?? 1)) || 1)
		recurrence.interval = interval > 1 ? interval : undefined // 1 is implied; never stored
		recurrence.byday = parts.BYDAY ? parts.BYDAY.split(',').map(code => code.trim().toUpperCase()).filter(Boolean) : undefined
		recurrence.bymonthday = parts.BYMONTHDAY ? Math.trunc(Number(parts.BYMONTHDAY)) || undefined : undefined
		if (parts.COUNT) {
			recurrence.count = Math.max(1, Math.trunc(Number(parts.COUNT)) || 1)
		} else if (parts.UNTIL) {
			recurrence.until = Recurrence.parseUntil(parts.UNTIL)
		}
		return recurrence
	}

	/** Rebuild from a plain object that crossed the wire (e.g. an HTTP body), normalising `until` to a
	 * DateTime. Picks the rule fields explicitly: a wire payload can carry anything, and none of it
	 * belongs on the value object. Judging the result is {@link valid}'s job, so a caller can 400 a
	 * present-but-malformed rule instead of silently dropping it. */
	static from(data: Partial<Recurrence> | undefined | null): Recurrence | undefined {
		if (!data || !data.freq) {
			return undefined
		}
		return new Recurrence({
			freq: data.freq,
			interval: data.interval,
			byday: data.byday,
			bymonthday: data.bymonthday,
			count: data.count,
			until: data.until ? new DateTime(data.until as unknown as string) : undefined,
		})
	}

	/** The date-derived quick presets (mirrors the screenshots' labels). */
	static presets(start: DateTime): Array<RecurrencePreset> {
		const wd = Recurrence.weekdayCode(start)
		const wdLabel = Recurrence.weekdayLabel(wd)
		const dayOfMonth = start.day
		const weekOfMonth = Math.floor((dayOfMonth - 1) / 7) + 1
		const isLastWeekdayOfMonth = dayOfMonth + 7 > start.daysInMonth
		return [
			{ id: 'none', label: String(t('Does not repeat')) },
			{ id: 'daily', label: Recurrence.frequencyLabel('DAILY'), recurrence: new Recurrence({ freq: 'DAILY' }) },
			{ id: 'weekday', label: String(t('Every weekday')), detail: `${Recurrence.weekdayLabel('MO')} – ${Recurrence.weekdayLabel('FR')}`, recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['MO', 'TU', 'WE', 'TH', 'FR'] }) },
			{ id: 'weekly', label: Recurrence.frequencyLabel('WEEKLY'), detail: String(t('on ${weekday}', { weekday: wdLabel })), recurrence: new Recurrence({ freq: 'WEEKLY', byday: [wd] }) },
			{ id: 'biweekly', label: Recurrence.frequencyLabel('WEEKLY', 2), detail: String(t('on ${weekday}', { weekday: wdLabel })), recurrence: new Recurrence({ freq: 'WEEKLY', interval: 2, byday: [wd] }) },
			{ id: 'monthly-day', label: Recurrence.frequencyLabel('MONTHLY'), detail: Recurrence.monthDayLabel(dayOfMonth), recurrence: new Recurrence({ freq: 'MONTHLY', bymonthday: dayOfMonth }) },
			{ id: 'monthly-weekday', label: Recurrence.frequencyLabel('MONTHLY'), detail: Recurrence.monthWeekdayLabel(`${weekOfMonth}${wd}`), recurrence: new Recurrence({ freq: 'MONTHLY', byday: [`${weekOfMonth}${wd}`] }) },
			...(isLastWeekdayOfMonth ? [{ id: 'monthly-last', label: Recurrence.frequencyLabel('MONTHLY'), detail: Recurrence.monthWeekdayLabel(`-1${wd}`), recurrence: new Recurrence({ freq: 'MONTHLY', byday: [`-1${wd}`] }) }] : []),
			{ id: 'yearly', label: Recurrence.frequencyLabel('YEARLY'), detail: String(t('on ${date}', { date: start.format({ month: 'short', day: 'numeric' }) })), recurrence: new Recurrence({ freq: 'YEARLY' }) },
		]
	}

	/** A sensible default for the Custom dialog when the entry has no rule yet: weekly on the start's weekday. */
	static defaultFor(start: DateTime): Recurrence {
		return new Recurrence({ freq: 'WEEKLY', byday: [Recurrence.weekdayCode(start)] })
	}

	/** Which preset id a rule matches, or `undefined` if it's custom (then the dropdown surfaces it on its own). */
	static matchedPresetId(presets: ReadonlyArray<RecurrencePreset>, recurrence?: Recurrence | null): string | undefined {
		if (!recurrence) {
			return 'none'
		}
		return presets.find(preset => preset.recurrence?.equals(recurrence))?.id
	}

	/** RRULE weekday code for a date. */
	static weekdayCode(date: DateTime): string {
		return WEEKDAY_CODES[date.dayOfWeek - 1]!
	}

	/** Short label ("Mon") for a weekday code, via Intl in the UI language, ignoring any leading ordinal
	 * (e.g. "-1TH" → "Thu"). */
	static weekdayLabel(code: string): string {
		const index = WEEKDAY_CODES.indexOf(code.replace(/^[+-]?\d+/, '') as typeof WEEKDAY_CODES[number])
		return index === -1 ? code : weekdayName(index)
	}

	/** "Every week", "Every 2 weeks": one plural entry per unit, whose singular form is the interval-less phrase. */
	static frequencyLabel(freq: Frequency, count = 1): string {
		switch (freq) {
			case 'DAILY': return String(t('Every ${count:pluralityNumber} days', { count }))
			case 'WEEKLY': return String(t('Every ${count:pluralityNumber} weeks', { count }))
			case 'MONTHLY': return String(t('Every ${count:pluralityNumber} months', { count }))
			case 'YEARLY': return String(t('Every ${count:pluralityNumber} years', { count }))
		}
	}

	/** "on the 25th" (BYMONTHDAY). */
	static monthDayLabel(day: number): string {
		return String(t('on the ${ordinal}', { ordinal: Recurrence.ordinal(day) }))
	}

	/** "on the 4th Thu", "on the last Thu" (a monthly BYDAY with its week ordinal). */
	static monthWeekdayLabel(code: string): string {
		const weekday = Recurrence.weekdayLabel(code)
		return String(code.startsWith('-1')
			? t('on the last ${weekday}', { weekday })
			: t('on the ${ordinal} ${weekday}', { ordinal: Recurrence.ordinal(Number(/^-?\d+/.exec(code)?.[0] ?? '1')), weekday }))
	}

	/** Ordinals like "1st", "2nd", "3rd", "4th", "21st". Intl.PluralRules picks the language's ordinal category
	 * and the dictionary its form (German "25.", French "1er"), keyed by the English form of that category. */
	static ordinal(n: number): string {
		switch (new Intl.PluralRules(language(), { type: 'ordinal' }).select(n)) {
			case 'one': return String(t('${n:number}st', { n }))
			case 'two': return String(t('${n:number}nd', { n }))
			case 'few': return String(t('${n:number}rd', { n }))
			default: return String(t('${n:number}th', { n }))
		}
	}

	/** A bare day-or-datetime UNTIL becomes UTC midnight of that calendar day (read back via getUTC*). */
	static untilFromDay(year: number, month: number, day: number): DateTime {
		return new DateTime(`${pad(year, 4)}-${pad(month)}-${pad(day)}T00:00:00.000Z`)
	}

	/** The UTC calendar day immediately before an instant: the UNTIL that ends a series just before a given
	 * occurrence (its end-of-day-UTC excludes that occurrence while including the prior one, for ≥daily rules). */
	static dayBefore(instant: Date): DateTime {
		const previous = calendarDateOf(instant, 'UTC').subtract({ days: 1 })
		return Recurrence.untilFromDay(previous.year, previous.month, previous.day)
	}

	/**
	 * The rule as it reads once its anchor moves from `from` to `to`: a weekday list rotates with the
	 * move and a month-day follows it, so the rule keeps matching its anchor (a rule that doesn't match
	 * its anchor silently loses every occurrence before its first match, the anchor's own). This is
	 * what "move ALL entries of a weekly-Monday series one day later" means: it becomes a Tuesday
	 * series. A time-only move (same calendar day) changes nothing.
	 */
	rebased(from: Date, to: Date, zone?: string | null): Recurrence {
		// The delta counts CALENDAR days in the series' own `zone` when the caller has one (the backend
		// passes the master's timeZone, the zone its occurrences and exclusions shift in), else local
		// days. UTC flooring would read a plain timed→all-day conversion as "one day earlier" in any
		// zone ahead of UTC (local midnight is the previous UTC day) and rotate the weekdays for a move
		// that never happened, and without the explicit zone, a server running elsewhere (a UTC
		// container) makes the same misreading of the user's midnights.
		const day = (value: Date) => calendarDateOf(value, zone)
		const deltaDays = day(to).since(day(from)).days
		if (deltaDays === 0) {
			return this
		}
		const patch: Partial<Recurrence> = {}
		if (this.byday?.length) {
			patch.byday = this.byday.map(code => {
				const match = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(code)
				const index = match ? WEEKDAY_CODES.indexOf(match[2] as typeof WEEKDAY_CODES[number]) : -1
				return index === -1 ? code : `${match![1] ?? ''}${WEEKDAY_CODES[(index + deltaDays % 7 + 7) % 7]}`
			})
		}
		if (this.bymonthday) {
			// Read in the same calendar as the delta: the UTC date of a zone's midnight is the day before.
			patch.bymonthday = calendarDateOf(to, zone).day
		}
		return this.with(patch)
	}

	/** This rule truncated to end before `recurrenceId` (UNTIL = the day before; COUNT cleared): the "old"
	 * half of a "this and following" split, or a "delete this and following". */
	endingBefore(recurrenceId: Date): Recurrence {
		return this.with({ until: Recurrence.dayBefore(recurrenceId), count: undefined })
	}

	/** This rule as a fresh series starting at a split point: keeps UNTIL; a COUNT-bounded rule carries
	 * the REMAINING count (the original minus `consumed`, the occurrences the old half kept), so a
	 * "10 times" series split after its first occurrence continues "9 times", never forever. */
	asContinuation(consumed = 0): Recurrence {
		return this.with({ count: this.count ? Math.max(1, this.count - consumed) : undefined })
	}

	private static parseUntil(value: string): DateTime | undefined {
		const match = /^(\d{4})(\d{2})(\d{2})/.exec(value)
		if (!match) {
			return undefined
		}
		return Recurrence.untilFromDay(Number(match[1]), Number(match[2]), Number(match[3]))
	}
}
