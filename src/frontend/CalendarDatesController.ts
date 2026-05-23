import { Controller, type Component } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { MemoizeExpiring as memoizeExpiring } from 'typescript-memoize'

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

	constructor(protected override readonly host: Component) {
		super(host)
	}

	get navigatingDate() { return this._navigatingDate }
	set navigatingDate(value: DateTime) {
		const DAYS_IN_WEEK = value.daysInWeek
		const BUFFER_WEEKS = 156 // 3 Years (52 * 3)
		const BUFFER_DAYS = BUFFER_WEEKS * DAYS_IN_WEEK
		const WEEKS_OFFSET_TRIGGER = 26 // Trigger regeneration when within 6 months of the edge
		const WEEKS_BACK_ON_REGEN = 78 // Center the view back in the middle of the 3 years

		const daysOffset = WEEKS_OFFSET_TRIGGER * DAYS_IN_WEEK

		const isOutOfBounds = !this._days.length || value.isBefore(this._days.at(daysOffset)!) || value.isAfter(this._days.at(-daysOffset)!);

		if (!isOutOfBounds && this._navigatingDate.dayStart.equals(value.dayStart)) {
			return;
		}

		this._navigatingDate = value
		this.host.dispatchEvent(new CustomEvent('navigate', { detail: value, bubbles: true, composed: true }))

		// Only regenerate the array if the boundary is hit. Otherwise, array stays perfectly static.
		if (isOutOfBounds) {
			const start = value.add({ days: - (WEEKS_BACK_ON_REGEN * DAYS_IN_WEEK) }).weekStart
			this._days = [...CalendarDatesController.generate(start, BUFFER_DAYS, 'days')]
			this.host.requestUpdate()
		}
	}

	get days() { return this._days }

	scrollToDate(date: DateTime) {
		this.host.updateComplete.then(() => {
			const dayEl = this.host.renderRoot.querySelector(`[data-date="${date.dayStart.toISOString()}"]`)
			if (dayEl) dayEl.scrollIntoView({ block: 'center', inline: 'center' })
		})
	}
}
