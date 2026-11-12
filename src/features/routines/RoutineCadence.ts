import { type Converter } from '@a11d/converter'
import { RecurrenceFrequency } from '#features/recurrence/RecurrenceFrequency.js'

/** The row a grid view stacks: the month view a strip of weeks, the year view a strip of months. */
export type RoutineUnit = 'week' | 'month'

/** How often a routine comes: the days from one of its dates to the next. Read off its members, never stored. */
export class RoutineCadence {
	/**
	 * A row's length in days, and how far past it a cadence may reach and still collapse there: the year view orients, so
	 * what comes about every five weeks is still marks in it, while a week row keeps a weekly entry as its bar.
	 */
	private static readonly rows: Record<RoutineUnit, { readonly days: number, readonly slack: number }> = {
		week: { days: RecurrenceFrequency.Weekly.days, slack: 1 },
		month: { days: RecurrenceFrequency.Monthly.days, slack: 1.25 },
	}

	/** How far a day may lie from where a cadence expects it and still keep it, as a share of the cadence; a day at least. */
	private static readonly tolerance = 0.2

	/** How many times the cadence a day may lie past the last one keeping it: a skipped date or two breaks none. */
	private static readonly reach = 3

	/** The share of the days that must keep a cadence for them to keep it. */
	private static readonly share = 0.75

	private static readonly first = Temporal.PlainDate.from('1970-01-01')

	/** On the wire as its days. */
	static readonly converter: Converter<number | null | undefined, RoutineCadence | undefined> = {
		construct: days => days === null || days === undefined ? undefined : new RoutineCadence(days),
		deconstruct: cadence => cadence?.days,
	}

	/** Each day once, as its count from a fixed one and in order, so the distance between two is a subtraction. */
	private static countsOf(days: Iterable<Temporal.PlainDate>) {
		return [...new Set([...days].map(day => RoutineCadence.first.until(day, { largestUnit: 'days' }).days))].sort((a, b) => a - b)
	}

	/** The cadence dates of their own come at: the median distance between neighbouring days. None below two days. */
	static between(days: Iterable<Temporal.PlainDate>) {
		const counts = RoutineCadence.countsOf(days)
		const gaps = counts.slice(1).map((count, index) => count - counts[index]!).sort((a, b) => a - b)
		const middle = gaps.length >> 1
		return !gaps.length ? undefined : new RoutineCadence(gaps.length % 2 ? gaps[middle]! : (gaps[middle - 1]! + gaps[middle]!) / 2)
	}

	/**
	 * The cadence of members repeating at `strides` beside others coming at a cadence of their `own`. Rules add up, three
	 * weekly ones coming every 2⅓ days, and the tighter of that and their own counts. None where neither says anything.
	 */
	static of(strides: ReadonlyArray<number>, own?: RoutineCadence) {
		const perDay = strides.reduce((sum, stride) => sum + 1 / stride, 0)
		const days = Math.min(perDay ? 1 / perDay : Infinity, own?.days ?? Infinity)
		return Number.isFinite(days) ? new RoutineCadence(days) : undefined
	}

	constructor(readonly days: number) { }

	/** Whether it comes more often than a row of `unit`, where its dates are then marks rather than bars. */
	collapsesIn(unit: RoutineUnit) {
		const { days, slack } = RoutineCadence.rows[unit]
		return this.days < days * slack
	}

	/**
	 * Whether `days` keep it, however sparse it is: most fall where it expects them. Walking them in order, a day keeps it
	 * when it lies one to three times the cadence past the last that did, give or take the tolerance. Days are judged
	 * rather than gaps, as one late date is one day off but two gaps.
	 */
	keptBy(days: Iterable<Temporal.PlainDate>) {
		const counts = RoutineCadence.countsOf(days)
		if (!counts.length) {
			return false
		}
		const tolerance = Math.max(this.days * RoutineCadence.tolerance, 1)
		let last = counts[0]!
		let kept = 1
		for (const count of counts.slice(1)) {
			const times = Math.round((count - last) / this.days)
			if (times >= 1 && times <= RoutineCadence.reach && Math.abs(count - last - times * this.days) <= tolerance) {
				last = count
				kept++
			}
		}
		return kept / counts.length >= RoutineCadence.share
	}
}
