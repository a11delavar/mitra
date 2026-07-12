import { Component, component, html, property, css, repeat, guard, type PropertyValues, eventListener, event, styleMap, ifDefined } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Entry } from 'shared'
import { EntrySegments } from './EntrySegments.js'
import { CalendarDatesController, type CalendarMonth } from './CalendarDatesController.js'
import { EntryDragController } from './EntryDragController.js'
import { MonthsDensityController } from './MonthsDensityController.js'

/**
 * The months strip — the year view's grid, and the vertical sibling of {@link Days}: one row per month
 * (scrolling seamlessly across year boundaries on the same 3-year buffer), one column per weekday-aligned
 * day slot, so weekdays line up vertically across the whole year like on a paper wall planner. "Year" is
 * just this strip at its default density — twelve rows filling the viewport; the density zoom (see
 * {@link MonthsDensityController}) turns the same strip into quarters or any other span of months.
 *
 * Cells are the same `mitra-day` as everywhere else (its own container queries collapse it to a bare day
 * numeral at this scale) and entries are the same `mitra-entry-segment` bars, one run per month row,
 * packed into lanes purely by CSS `grid-auto-flow: row dense` (like the week's all-day lane — no JS
 * lanes). DOM order is the packing priority: multi-day arcs first, then all-day, then timed
 * (`EntrySegments.laneRank`), so the entries that shape a year keep the visible lanes and a row too dense
 * for its height simply clips — zooming in is the reveal, and the segments' container queries shed labels
 * as lanes get tight.
 */
@component('mitra-months')
export class Months extends Component {
	@event({ bubbles: true, composed: true }) readonly navigate!: EventDispatcher<DateTime>
	@event({ bubbles: true, composed: true }) readonly switchToMonth!: EventDispatcher

	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	// A deep render window: at the default density the viewport alone spans 12 months, so the radius
	// must stay comfortably ahead of half of that plus the shift (see CalendarDatesController.window) —
	// and the regeneration trigger must exceed the same half-viewport (~26 weeks), or the scroll clamps
	// at the buffer's edge before the center can ever reach the default margin (a one-way dead end).
	// A large bufferWeeks (~10 years) keeps regeneration — the scroll-jarring "wall" — rare during fast,
	// far scrolling; it's cheap, since only the render window is populated (the rest is empty tracks).
	// radiusDays is generous (±~10 months) so a fast fling has runway before it outruns rendered content;
	// the `guard` on monthTemplate keeps the extra cells cheap to keep up.
	private readonly buffer: CalendarDatesController = new CalendarDatesController(this, { radiusDays: 300, shiftDays: 28, triggerWeeks: 52, bufferWeeks: 520 })
	protected readonly entryDrag = new EntryDragController(this, 'year')
	protected readonly density = new MonthsDensityController(this)

	private get segments(): EntrySegments { return EntrySegments.of(this.entries, this.buffer.window.days) }

	/** Day-slot columns: a full month of 31 plus the widest weekday offset. */
	private get columns() { return 31 + this.navigatingDate.daysInWeek - 1 }

	protected override initialized() {
		this.buffer.navigatingDate = this.navigatingDate
		this.buffer.scrollToDate(this.navigatingDate)
	}

	/** Set while the user is actively scrolling (cleared a beat after the last scroll event). It gates the
	 * `updated()` re-anchor below: during scroll, our incoming `navigatingDate` is just the page echoing
	 * back what our own scroll set — and it LAGS the buffer, so re-anchoring to it would reset the buffer
	 * to a stale month and `scrollIntoView` the view backwards, fighting the scroll (and looping). */
	private scrollIdle?: ReturnType<typeof setTimeout>

	protected override updated(props: PropertyValues<this>) {
		// Re-anchor only for EXTERNAL navigation (Today, palette, prev/next) — never mid-scroll, when
		// `navigatingDate` is the buffer's own echo coming back through the page (see `scrollIdle`).
		if (props.has('navigatingDate') && this.scrollIdle === undefined && !this.navigatingDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.buffer.navigatingDate = this.navigatingDate
			this.buffer.scrollToDate(this.navigatingDate)
		}
		this.style.setProperty('--_months-count', this.buffer.months.length.toString())
		this.style.setProperty('--_columns-count', this.columns.toString())
	}

	@eventListener('scroll')
	protected handleScroll(e: Event) {
		// Mark the view as actively scrolling for a short window past the last event (see `scrollIdle`).
		clearTimeout(this.scrollIdle)
		this.scrollIdle = setTimeout(() => this.scrollIdle = undefined, 150)

		const target = e.target as HTMLElement
		const months = this.buffer.months
		// A zoom gesture's per-frame pinning scrolls too — resolving those frames would walk the
		// navigating date (and its fetch window) through every intermediate month; the density
		// controller re-dispatches one scroll once the gesture settles.
		if (!months.length || this.density.active) {
			return
		}
		const headerHeight = this.querySelector('.corner')?.clientHeight ?? 0
		// Measure the row pitch from a rendered cell (its height is exactly one month row) plus the 1px grid
		// gap, rather than deriving it from scrollHeight/count: Firefox miscomputes this tall grid's
		// scrollHeight (≈ the viewport), which would map any scroll onto the entire buffer — a decade a nudge.
		const cell = this.querySelector<HTMLElement>('mitra-day')
		const rowHeight = cell ? cell.getBoundingClientRect().height + 1 : (target.scrollHeight - headerHeight) / months.length
		const centerRow = Math.floor((target.scrollTop + target.clientHeight / 2 - headerHeight) / rowHeight)
		const month = months[Math.max(0, Math.min(centerRow, months.length - 1))]

		if (month && !month.first.monthStart.equals(this.buffer.navigatingDate.monthStart)) {
			const days = this.buffer.days
			this.buffer.navigatingDate = month.first
			if (this.buffer.days !== days) {
				// The buffer regenerated around the new date: every row shifted under the unchanged
				// scroll offset, so re-anchor it to the month it meant.
				this.buffer.scrollToDate(this.buffer.navigatingDate)
			}
		}
	}

	static override get styles() {
		return css`
			mitra-months {
				display: grid;
				grid-template-columns: auto repeat(var(--_columns-count, 37), minmax(1.375rem, 1fr));
				grid-template-rows: 1.75rem repeat(var(--_months-count, 12), var(--month-height));
				/* Twelve rows (their gaps and the header's included) fill the viewport at zoom 1; the
				   density zoom is a pure multiplier on that. The max() keeps rows usable on very short
				   viewports — then the year itself scrolls. */
				--month-height: max(3rem, calc((100% - 1.75rem - 13px) / 12 * var(--months-zoom, 1)));
				gap: 1px;
				height: 100%;
				min-height: 0;
				background-color: var(--color-border);
				overflow: auto;
				/* Rows are placed at explicit tracks and re-anchored programmatically (zoom pinning,
				   scrollToDate) — the browser's own anchoring would fight both whenever the rendered
				   window swaps rows above the viewport. */
				overflow-anchor: none;
				/* Single-finger pan scrolls; two-finger pinch is claimed by the MonthsDensityController. */
				touch-action: pan-x pan-y;
				scrollbar-width: none;

				&::-webkit-scrollbar {
					display: none;
				}

				> .corner {
					grid-area: 1 / 1;
					position: sticky;
					top: 0;
					inset-inline-start: 0;
					z-index: 300;
					background-color: var(--color-background);
					border-bottom: var(--border);
					border-inline-end: var(--border);
				}

				> .weekdays {
					grid-row: 1;
					grid-column: 2 / -1;
					display: grid;
					grid-template-columns: subgrid;
					position: sticky;
					top: 0;
					z-index: 200;
					background-color: var(--color-background);
					border-bottom: var(--border);

					.weekday {
						container-type: inline-size;
						text-align: center;
						align-content: center;
						font-size: 0.7rem;
						font-weight: 500;
						color: var(--color-text-muted);
						overflow: hidden;

						/* The same weekday twice: the short name when the column affords it, the bare
						   initial in tight columns — a container query can only choose, not rewrite. */
						.narrow {
							display: none;
						}

						@container (max-width: 2.25rem) {
							.short {
								display: none;
							}

							.narrow {
								display: block;
							}
						}
					}
				}

				/* The month rail: direct children only — .label recurs inside the entry segments. */
				> .label {
					grid-column: 1;
					position: sticky;
					inset-inline-start: 0;
					z-index: 110;
					background-color: var(--color-background);
					border-inline-end: var(--border);
					display: flex;
					align-items: center;
					padding-inline: 0.625rem;
					font-size: 0.75rem;
					font-weight: 600;
					color: var(--color-text-muted);
					white-space: nowrap;
					cursor: pointer;

					&:hover {
						color: var(--color-text);
					}
				}

				/* The year cell IS a mitra-day, collapsed to a bare centred numeral. Driven from the parent
				   (not mitra-day's own container queries) because a year cell can't be told apart from a
				   narrow mobile month cell by its own size alone — and the day number scales continuously
				   with the cell width (cqi) instead of snapping at a breakpoint, so it never jumps as the
				   strip resizes (sidebar toggle, density zoom). container-type: size makes the cell its own
				   query container for the cqi below. */
				> mitra-day {
					container-type: size;

					/* Nested under .header to match — and out-specify — Day.ts's own .header rules. */
					.header {
						position: static;
						inset: auto;
						/* center, not baseline: the today circle must not shift the numeral off its neighbours. */
						align-items: center;
						justify-content: center;
						padding: 0.125rem 0;

						.weekday, .month {
							display: none;
						}

						.day {
							font-size: clamp(0.5rem, 22cqi, 0.8rem);
							color: var(--color-text-muted);
							/* Every numeral occupies the same fixed box, so today's circle sits behind it
							   without changing where the digits land. */
							inline-size: 1.2rem;
							block-size: 1.2rem;
							padding: 0;

							&[data-today] {
								color: var(--color-accent-text);
								min-width: 1.2rem;
								min-height: 1.2rem;
								inline-size: 1.2rem;
								block-size: 1.2rem;
								border-radius: 50%;
								padding: 0;
							}
						}
					}
				}

				> .entries {
					grid-column: 2 / -1;
					display: grid;
					grid-template-columns: subgrid;
					grid-auto-rows: 1rem;
					grid-auto-flow: row dense;
					gap: 1px;
					/* Below the day numerals; a row denser than its height clips, fading out as the hint
					   that zooming in reveals more. */
					padding-block-start: 1.125rem;
					overflow: hidden;
					mask-image: linear-gradient(to bottom, black calc(100% - 0.625rem), transparent);
					/* The lanes overlay the day cells, which are the create-gesture (and pointer) surface —
					   only the bars themselves are interactive. */
					pointer-events: none;

					mitra-entry-segment {
						pointer-events: auto;
						z-index: 2;
						margin-top: 0;

						> .heading {
							overflow: hidden;

							> .label {
								white-space: nowrap;
								text-overflow: ellipsis;
								overflow: hidden;
							}
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const { days: windowDays } = this.buffer.window
		const firstValue = windowDays[0]?.dayStart.valueOf() ?? 0
		const lastValue = windowDays.at(-1)?.dayStart.valueOf() ?? 0
		const todayValue = new DateTime().dayStart.valueOf()
		const week = CalendarDatesController.sampleWeek

		// Only the months intersecting the render window get real content, each at its explicit row;
		// every other buffer month is just its (empty) grid track, so the scrollbar geometry — and the
		// scroll-position→date math above — never depends on what's rendered.
		return html`
			<div class="corner"></div>
			<div class="weekdays">
				${Array.from({ length: this.columns }, (_, column) => {
					const day = week[column % week.length]!
					return html`
						<div class="weekday">
							<span class="short">${day.format({ weekday: 'short' })}</span>
							<span class="narrow">${day.format({ weekday: 'narrow' })}</span>
						</div>
					`
				})}
			</div>
			${repeat(this.buffer.months, month => month.firstValue, (month, index) =>
				month.intersects(firstValue, lastValue)
					// guard: a month's rendered content derives purely from (month, entries, today, its row),
					// none of which change as you scroll WITHIN the window — so skip re-running the expensive
					// monthTemplate (runsIn + lane sort + ~30 cells) on those renders. It re-runs only when a
					// month actually enters the window, its entries change, or the day rolls over.
					? guard([month, this.entries, todayValue, index], () => this.monthTemplate(month, index + 2, todayValue))
					: html.nothing)}
		`
	}

	private monthTemplate(month: CalendarMonth, row: number, todayValue: number) {
		// The rail navigates to the month's MIDDLE, not its first day: the month view centers the target's
		// week, and day 1 often sits in a week that still belongs to the previous month.
		return html`
			<div class="label" style="grid-row: ${row};" @click=${() => { this.navigate.dispatch(month.first.monthStart.add({ days: 14 })); this.switchToMonth.dispatch() }}>
				${month.first.format({ month: 'short', ...(month.number === 1 ? { year: 'numeric' as const } : {}) })}
			</div>
			${month.days.map((day, index) => html`
				<mitra-day
					data-date=${day.dayStart.toISOString()}
					data-with-background
					style="grid-row: ${row}; grid-column: ${month.firstColumn + index + 2};"
					.date=${day}
					?today=${day.dayStart.valueOf() === todayValue}
				></mitra-day>
			`)}
			${this.entriesTemplate(month, row)}
		`
	}

	private entriesTemplate(month: CalendarMonth, row: number) {
		// A stable sort by lane priority: multi-day arcs, then all-day, then timed — within a rank,
		// runsIn's chronological order survives, and DOM order drives the dense lane packing. Rank is
		// computed ONCE per segment (it costs DateTime math via Entry.multiDay), not per comparison.
		const segments = this.segments.runsIn(month.first, month.last, () => true)
			.map(segment => ({ segment, rank: EntrySegments.laneRank(segment.entry) }))
			.sort((a, b) => a.rank - b.rank)
			.map(ranked => ranked.segment)
		return html`
			<div class="entries" style="grid-row: ${row};">
				${repeat(segments, segment => segment.entry, segment => {
					const startColumn = month.columnOf(segment.dayValue!)
					const clippedRight = segment.runEnd.dayValue! > month.lastValue
					const endColumn = clippedRight ? month.firstColumn + month.days.length - 1 : month.columnOf(segment.runEnd.dayValue!)
					return html`
						<mitra-entry-segment
							style=${styleMap({ gridColumn: `${startColumn + 1} / span ${endColumn - startColumn + 1}` })}
							resize=${ifDefined(segment.entry.allDay ? 'inline' : undefined)}
							?has-previous=${segment.hasPrevious}
							?has-next=${clippedRight}
							.segment=${segment}
						></mitra-entry-segment>
					`
				})}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-months': Months
	}
}
