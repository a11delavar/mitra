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

	/**
	 * @param rendering The render-window shape (see {@link window}): `radiusDays` days each side of the
	 * navigating date get real content; the window recenters only after drifting `shiftDays` from its
	 * center (hysteresis — one re-render per `shiftDays` of scrolling, not one per day). The radius must
	 * comfortably exceed the widest viewport's half plus the shift, so unrendered tracks never scroll
	 * into view between recenters.
	 */
	constructor(
		protected override readonly host: Component,
		private readonly rendering: { radiusDays: number, shiftDays: number } = { radiusDays: 35, shiftDays: 7 },
	) {
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

		const isOutOfBounds = !this._days.length || value.isBefore(this._days.at(daysOffset)!) || value.isAfter(this._days.at(-daysOffset)!)

		if (!isOutOfBounds && this._navigatingDate.dayStart.equals(value.dayStart)) {
			return
		}

		this._navigatingDate = value
		this.host.dispatchEvent(new CustomEvent('navigate', { detail: value, bubbles: true, composed: true }))

		// Only regenerate the array if the boundary is hit. Otherwise, array stays perfectly static.
		if (isOutOfBounds) {
			const start = value.add({ days: - (WEEKS_BACK_ON_REGEN * DAYS_IN_WEEK) }).weekStart
			this._days = [...CalendarDatesController.generate(start, BUFFER_DAYS, 'days')]
			this._window = undefined
			this.host.requestUpdate()
		} else if (this._window && Math.abs(value.dayStart.valueOf() - this._window.centerValue) >= this.rendering.shiftDays * 86_400_000) {
			// Drifted far enough from the rendered window's center: recenter it on the next render.
			this._window = undefined
			this.host.requestUpdate()
		}
	}

	get days() { return this._days }

	private _window?: { days: ReadonlyArray<DateTime>, offset: number, centerValue: number }

	/**
	 * The days to actually RENDER — a slice of {@link days} around the navigating date. The full buffer
	 * only provides scroll geometry: both views place children at explicit grid positions, so the days
	 * outside the window are simply empty tracks (cheap), while the expensive subgridded day trees exist
	 * for ~{@link rendering}.radiusDays×2 days instead of the whole 3-year buffer. The slice's identity
	 * is stable between recenters, so per-`days` memos (e.g. `EntrySegments.of`) keep hitting.
	 */
	get window(): { days: ReadonlyArray<DateTime>, offset: number } {
		if (!this._window) {
			const first = this._days[0]
			// Consecutive local days: the index is the (DST-tolerant, hence rounded) day distance.
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

	scrollToDate(date: DateTime) {
		this.host.updateComplete.then(() => {
			const dayEl = this.host.renderRoot.querySelector(`[data-date="${date.dayStart.toISOString()}"]`)
			if (dayEl) dayEl.scrollIntoView({ block: 'center', inline: 'center' })
		})
	}
}
