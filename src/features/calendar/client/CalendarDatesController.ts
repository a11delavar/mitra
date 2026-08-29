import { Controller, type Component } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { MemoizeExpiring as memoizeExpiring } from 'typescript-memoize'

/**
 * Calendar month representation within the buffered date window.
 */
export class CalendarMonth {
	constructor(readonly days: ReadonlyArray<DateTime>) { }

	get first() { return this.days[0]! }
	get last() { return this.days[this.days.length - 1]! }

	get number() { return this.first.month }

	get firstValue() { return this.first.dayStart.valueOf() }
	get lastValue() { return this.last.dayStart.valueOf() }

	get firstColumn() { return this.first.monthStart.dayOfWeek - 1 + this.first.day - 1 }

	intersects(from: number, to: number) { return this.firstValue <= to && this.lastValue >= from }

	columnOf(dayValue: number) { return this.firstColumn + Math.round((dayValue - this.firstValue) / 86_400_000) }
}

export class CalendarDatesController extends Controller {
	@memoizeExpiring(60_000)
	static get today() { return new DateTime().dayStart }

	static *generate(start: DateTime, count: number, step: 'days' | 'months' | 'years') {
		for (let i = 0; i < count; i++) {
			yield start.add({ [step]: i })
		}
	}

	private static _sampleWeek = new Array<DateTime>()
	static get sampleWeek() { return this._sampleWeek as ReadonlyArray<DateTime> }

	private static generateWeek() {
		const sample = [...CalendarDatesController.generate(CalendarDatesController.today, CalendarDatesController.today.daysInWeek * 2, 'days')]
		const indexOfFirstWeekStart = sample.findIndex(d => d.dayOfWeek === 1)
		const daysInWeek = sample[0]!.daysInWeek
		CalendarDatesController._sampleWeek = sample.slice(indexOfFirstWeekStart, indexOfFirstWeekStart + daysInWeek).map(d => d.dayStart)
	}

	static {
		CalendarDatesController.generateWeek()
	}

	private _navigatingDate = new DateTime().dayStart
	private _days = new Array<DateTime>()

	constructor(
		protected override readonly host: Component,
		private readonly rendering: { radiusDays: number, shiftDays: number, triggerWeeks?: number, bufferWeeks?: number } = { radiusDays: 35, shiftDays: 7 },
	) {
		super(host)
	}

	get navigatingDate() { return this._navigatingDate }
	set navigatingDate(value: DateTime) {
		const DAYS_IN_WEEK = value.daysInWeek
		const BUFFER_WEEKS = this.rendering.bufferWeeks ?? 156
		const BUFFER_DAYS = BUFFER_WEEKS * DAYS_IN_WEEK
		const WEEKS_OFFSET_TRIGGER = this.rendering.triggerWeeks ?? 26
		const WEEKS_BACK_ON_REGEN = Math.floor(BUFFER_WEEKS / 2)

		const daysOffset = WEEKS_OFFSET_TRIGGER * DAYS_IN_WEEK

		const isOutOfBounds = !this._days.length || value.isBefore(this._days.at(daysOffset)!) || value.isAfter(this._days.at(-daysOffset)!)

		if (!isOutOfBounds && this._navigatingDate.dayStart.equals(value.dayStart)) {
			return
		}

		this._navigatingDate = value
		this.host.dispatchEvent(new CustomEvent('navigate', { detail: value, bubbles: true, composed: true }))

		if (isOutOfBounds) {
			const start = value.add({ days: - (WEEKS_BACK_ON_REGEN * DAYS_IN_WEEK) }).weekStart
			this._days = [...CalendarDatesController.generate(start, BUFFER_DAYS, 'days')]
			this._window = undefined
			this.host.requestUpdate()
		} else if (this._window && Math.abs(value.dayStart.valueOf() - this._window.centerValue) >= this.rendering.shiftDays * 86_400_000) {
			this._window = undefined
			this.host.requestUpdate()
		}
	}

	get days() { return this._days }

	private _months?: { readonly days: ReadonlyArray<DateTime>, readonly months: ReadonlyArray<CalendarMonth> }

	/** Buffer days grouped into consecutive CalendarMonth rows. */
	get months(): ReadonlyArray<CalendarMonth> {
		if (this._months?.days !== this._days) {
			const grouped = new Array<Array<DateTime>>()
			for (const day of this._days) {
				const current = grouped.at(-1)
				if (current && day.month === current[0]!.month) {
					current.push(day)
				} else {
					grouped.push([day])
				}
			}
			this._months = { days: this._days, months: grouped.map(days => new CalendarMonth(days)) }
		}
		return this._months.months
	}

	private _window?: { days: ReadonlyArray<DateTime>, offset: number, centerValue: number }

	/** Active rendered day slice centered on navigatingDate. */
	get window(): { days: ReadonlyArray<DateTime>, offset: number } {
		if (!this._window) {
			const first = this._days[0]
			const center = !first ? 0 : Math.round((this._navigatingDate.dayStart.valueOf() - first.valueOf()) / 86_400_000)
			const start = Math.max(0, center - this.rendering.radiusDays)
			this._window = {
				days: this._days.slice(start, Math.min(this._days.length, center + this.rendering.radiusDays + 1)),
				offset: start,
				centerValue: this._navigatingDate.dayStart.valueOf(),
			}
		}
		return this._window
	}
}
