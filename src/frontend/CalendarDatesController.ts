import { Controller, type Component } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { MemoizeExpiring as memoizeExpiring } from 'typescript-memoize'

/**
 * One calendar month of the buffer — the row unit of the year strip. A thin value object over the
 * month's consecutive days; every fact reads straight off the (memoising, stable) `DateTime` instances,
 * so there's nothing to precompute or cache. Buffer days carry the buffer's generation clock time, hence
 * the `.dayStart` on every epoch/ISO key.
 */
export class CalendarMonth {
	constructor(readonly days: ReadonlyArray<DateTime>) { }

	/** The month's first/last buffered day (day 1 … month end, unless clipped at the buffer's edge). */
	get first() { return this.days[0]! }
	get last() { return this.days[this.days.length - 1]! }

	/** 1-based month number — for month-dependent formatting (a year on the January label). */
	get number() { return this.first.month }

	/** Day-start epoch-ms of the first/last day — the same-day comparison keys. */
	get firstValue() { return this.first.dayStart.valueOf() }
	get lastValue() { return this.last.dayStart.valueOf() }

	/** The 0-based weekday column its first day sits in, so weekdays align vertically across rows: the
	 * day-1 weekday offset, plus its day-of-month for a buffer-edge partial month. */
	get firstColumn() { return this.first.monthStart.dayOfWeek - 1 + this.first.day - 1 }

	/** Whether the month touches the `[from, to]` day-start-epoch-ms render window. */
	intersects(from: number, to: number) { return this.firstValue <= to && this.lastValue >= from }

	/** The 0-based day-slot column of the day at `dayValue` (day-start epoch-ms) within this month. */
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

	/**
	 * @param rendering The render-window shape (see {@link window}): `radiusDays` days each side of the
	 * navigating date get real content; the window recenters only after drifting `shiftDays` from its
	 * center (hysteresis — one re-render per `shiftDays` of scrolling, not one per day). The radius must
	 * comfortably exceed the widest viewport's half plus the shift, so unrendered tracks never scroll
	 * into view between recenters. `triggerWeeks` is the buffer's regeneration margin: entering the last
	 * `triggerWeeks` of the buffer regenerates it around the new date. Scroll-driven navigation reads the
	 * viewport's CENTER, which can never get closer to the buffer's edge than half the viewport's span —
	 * so a view whose viewport spans months (the year strip) must widen this margin beyond that half, or
	 * the scrollbar clamps before the trigger is ever reached and the strip dead-ends. `bufferWeeks` is
	 * the total span the buffer holds: regeneration (which re-anchors the scroll — a visible "jump")
	 * fires every ~`bufferWeeks/2 − triggerWeeks` weeks of continuous scrolling, so a view that scrolls
	 * far and fast (the year strip) wants this large. It's cheap: only the render window is populated,
	 * the rest of the buffer is empty grid tracks.
	 */
	constructor(
		protected override readonly host: Component,
		private readonly rendering: { radiusDays: number, shiftDays: number, triggerWeeks?: number, bufferWeeks?: number } = { radiusDays: 35, shiftDays: 7 },
	) {
		super(host)
	}

	get navigatingDate() { return this._navigatingDate }
	set navigatingDate(value: DateTime) {
		const DAYS_IN_WEEK = value.daysInWeek
		const BUFFER_WEEKS = this.rendering.bufferWeeks ?? 156 // default: 3 years (52 * 3)
		const BUFFER_DAYS = BUFFER_WEEKS * DAYS_IN_WEEK
		const WEEKS_OFFSET_TRIGGER = this.rendering.triggerWeeks ?? 26 // Trigger regeneration within this margin of the edge
		const WEEKS_BACK_ON_REGEN = Math.floor(BUFFER_WEEKS / 2) // Center the view back in the middle of the buffer

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

	private _months?: { readonly days: ReadonlyArray<DateTime>, readonly months: ReadonlyArray<CalendarMonth> }

	/** The buffer's days grouped into consecutive {@link CalendarMonth} rows — the year strip's row
	 * structure. Memoised on the buffer's identity (which only changes on regeneration), so scrolling —
	 * which reads this on every `scroll` event — never re-groups or re-allocates. The grouping itself is
	 * cheap (the buffer's `DateTime` instances memoise their own accessors); it's the per-read allocation
	 * of a fresh array of {@link CalendarMonth}s that this avoids, and that matters at scroll frequency. */
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
