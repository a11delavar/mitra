import { Component, component, html, property, css, repeat, type PropertyValues, eventListener, ifDefined, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { EntryType, type Entry } from 'shared'
import { getSource } from './Api.js'
import { EntrySegments } from './EntrySegments.js'
import { type EntrySegment } from './EntrySegment.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { EntryDragController } from './EntryDragController.js'
import { TimelineDensityController } from './TimelineDensityController.js'

/** An entry's run projected onto the render window as a column-spanning bar. */
interface TimelineBar {
	readonly segment: EntrySegment
	readonly startColumn: number
	readonly span: number
	readonly clippedRight: boolean
}

/** The timeline view: the 2-weeks-to-6-months planning band between the week view and the month
 * view's grid, on one horizontally-scrolling, day-granular axis. Unlike `Days` and `Weeks` it isn't
 * named after a stripped unit: its identity is the Gantt-like canvas, not the unit.
 *
 * The view splits entries by their role in planning, not by lane availability: all-day EVENTS are the
 * fixed calendar context the user plans *around* (a trip, a conference, a public holiday) — they render
 * as bands in the axis header, GitHub-roadmap-marker style, and tint their days down through the body —
 * while TASKS are the malleable work being *placed*, owning the body's packed lanes (CSS
 * `grid-auto-flow: dense` — non-overlapping runs share a lane). Timed events (the daily churn:
 * standups, 1:1s) don't render here at all — at this horizon they are noise, not plan; they belong to
 * the week and month views. Clock times never affect layout, only the day span does. */
@component('mitra-timeline')
export class Timeline extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	// The viewport can span up to ~half a year (see TimelineDensityController.max = 180 days), so the
	// render window's radius must stay comfortably ahead of the half-viewport plus the recenter
	// hysteresis (see CalendarDatesController.window): 120 ≥ 90 + 21.
	private readonly dates: CalendarDatesController = new CalendarDatesController(this, { radiusDays: 120, shiftDays: 21 })
	protected readonly entryDrag = new EntryDragController(this, 'timeline')
	protected readonly density = new TimelineDensityController(this)

	private get days(): Array<DateTime> { return this.dates.days }
	// Segments over the RENDER WINDOW, not the whole buffer — offscreen days need no slicing.
	private get segments() { return EntrySegments.of(this.entries, this.dates.window.days) }

	protected override initialized() {
		this.dates.navigatingDate = this.navigatingDate
		this.dates.scrollToDate(this.navigatingDate)
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.dates.navigatingDate.dayStart)) {
			this.dates.navigatingDate = this.navigatingDate
			this.dates.scrollToDate(this.navigatingDate)
		}
		this.style.setProperty('--_days-length', this.days.length.toString())
	}

	@eventListener('scroll')
	protected handleScroll(e: Event) {
		const target = e.target as HTMLElement
		const colWidth = target.scrollWidth / this.days.length
		// Math.abs() because in RTL, scrollLeft is negative — its magnitude is the distance from the
		// inline start, which is also where column 1 sits.
		const centerPixel = Math.abs(target.scrollLeft) + target.clientWidth / 2
		const centerCol = Math.floor(centerPixel / colWidth)
		const centerDate = this.days[Math.min(Math.max(0, centerCol), this.days.length - 1)]

		if (centerDate && !centerDate.dayStart.equals(this.dates.navigatingDate.dayStart)) {
			this.dates.navigatingDate = centerDate
		}
	}

	static override get styles() {
		return css`
			mitra-timeline {
				display: grid;
				grid-template-rows: auto 1fr;
				/* ONE grid owns every column: one --day-width track per buffered day (the density
				   controller's single output; the pre-measurement fallback below keeps the grid sane
				   before the first measure). Everything — header cells, backdrop shading, entry bars —
				   self-places onto these shared tracks by date, so the axis and the canvas align by
				   construction and zooming is a single custom-property write. */
				grid-template-columns: repeat(var(--_days-length, 1), var(--day-width));
				--day-width: 2rem;
				min-height: 0;
				min-width: 0;
				overflow: auto;
				/* Single-finger pan still scrolls the canvas; two-finger pinch-zoom is disabled here so
				   the TimelineDensityController can own it (see its touch handlers). */
				touch-action: pan-x pan-y;
				scrollbar-width: none; /* Firefox */

				&::-webkit-scrollbar {
					display: none; /* Chrome/Safari */
				}

				mitra-entry-segment {
					margin-top: 0 !important;
					flex-direction: row !important;
					align-items: center !important;
					gap: 0.375rem !important;
					padding: 0 0.375rem !important;

					> .time {
						display: block !important;

						.separator, .end {
							display: none !important;
						}

						/* A pill too narrow for both loses the time before the heading. */
						@container (max-width: 6rem) {
							display: none !important;
						}
					}

					> .heading {
						flex: 1 !important;
						white-space: nowrap !important;
						overflow: hidden !important;
						text-overflow: ellipsis !important;
					}
				}

				.header {
					grid-column: 1 / -1;
					grid-row: 1;
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: auto auto auto;
					position: sticky;
					top: 0;
					z-index: 200;
					background-color: var(--color-background);
					border-bottom: var(--border);

					.month {
						grid-row: 1;
						display: flex;
						padding-block: 0.25rem;
						border-inline-start: 1px solid color-mix(in srgb, var(--color-text-muted) 25%, transparent);

						/* The label stays in view while its month is partially scrolled past: sticky
						   against the scroll container, but never leaving the month's own cell. */
						> span {
							position: sticky;
							inset-inline-start: 0.5rem;
							width: max-content;
							font-size: 0.75rem;
							font-weight: 600;
							color: var(--color-text-muted);
							padding-inline: 0.5rem;
							white-space: nowrap;
						}
					}

					.day {
						grid-row: 2;
						container-type: inline-size;
						text-align: center;
						padding-block: 0.25rem;
						font-size: 0.65rem;
						font-weight: 500;
						color: var(--color-text-muted);

						> span {
							display: inline-block;
							min-width: 1.125rem;
							line-height: 1.125rem;
							border-radius: 999px;
						}

						/* Continuous zoom instead of discrete levels: as columns narrow past a label's
						   width, plain day numbers bow out and only week starts (and today) keep theirs —
						   the month↔quarter header transition, but fluid. */
						&:not([data-week-start]):not([data-today]) > span {
							@container (max-width: 1.25rem) {
								display: none;
							}
						}

						&[data-today] > span {
							background-color: var(--color-accent);
							color: var(--color-accent-text);
						}
					}

					/* The context lane: all-day events as bands under the day numbers — the personal
					   analogue of GitHub's iteration/milestone markers row. Same packing as the body. */
					.events {
						grid-row: 3;
						grid-column: 1 / -1;
						display: grid;
						grid-template-columns: subgrid;
						grid-auto-rows: 1.5rem;
						grid-auto-flow: row dense;
						row-gap: 2px;
						align-content: start;

						&:has(mitra-entry-segment) {
							padding-block: 0.125rem 0.25rem;
						}
					}
				}

				.backdrop {
					grid-column: 1 / -1;
					grid-row: 2;
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: 1fr;

					.day {
						grid-row: 1;
						background-color: var(--color-surface);
						border-inline-start: var(--border);

						&[data-month-start] {
							border-inline-start-color: color-mix(in srgb, var(--color-text-muted) 35%, transparent);
						}

						/* The today line — the one full-height vertical marker of the view. */
						&[data-today] {
							border-inline-start: 2px solid var(--color-accent);
						}
					}

					/* A header band's context reaching down through the body: the days a trip or holiday
					   covers carry its tint, so the work planned into them visibly overlaps it. */
					.shade {
						grid-row: 1;
						background-color: color-mix(in srgb, var(--_shade-color, transparent) 10%, transparent);
					}
				}

				.entries {
					grid-column: 1 / -1;
					grid-row: 2;
					display: grid;
					grid-template-columns: subgrid;
					/* Bars self-place columns by date; dense packing assigns lanes, so non-overlapping
					   runs share a row. DOM order (earliest, then longest run first — see
					   EntrySegments.runsIn) decides who claims the low lanes. */
					grid-auto-rows: 1.5rem;
					grid-auto-flow: row dense;
					row-gap: 2px;
					align-content: start;
					padding-block: 0.375rem;
					z-index: 1;
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const context = (entry: Entry) => entry.type === EntryType.Event && !!entry.allDay
		const events = this.bars(context)
		const tasks = this.bars(entry => entry.type === EntryType.Task)
		return html`
			${this.headerTemplate(events)}
			${this.backdropTemplate(events)}
			${this.entriesTemplate(tasks)}
		`
	}

	/** Each accepted entry's run projected onto the window as a column-spanning bar. Bars render (and
	 * clip) against the window — a run's parts beyond it are offscreen by definition. */
	private bars(accept: (entry: Entry) => boolean): Array<TimelineBar> {
		const { days, offset } = this.dates.window
		const first = days[0]
		const last = days.at(-1)
		if (!first || !last) {
			return []
		}
		// Built once per call so each bar's column is an O(1) numeric lookup (segments cache their dayValue).
		const lastValue = last.dayStart.valueOf()
		const columnByDay = new Map(days.map((day, index) => [day.dayStart.valueOf(), offset + index]))
		const columnOf = (dayValue?: number) => columnByDay.get(dayValue ?? -1) ?? 0
		return this.segments.runsIn(first, last, accept).map(segment => {
			const startColumn = columnOf(segment.dayValue)
			const clippedRight = segment.runEnd.dayValue! > lastValue
			const endColumn = clippedRight ? offset + days.length - 1 : columnOf(segment.runEnd.dayValue)
			return { segment, startColumn, span: endColumn - startColumn + 1, clippedRight }
		})
	}

	private barTemplate(bar: TimelineBar) {
		return html`
			<mitra-entry-segment
				style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.span}` })}
				resize=${ifDefined(bar.segment.entry.allDay ? 'inline' : undefined)}
				?has-previous=${bar.segment.hasPrevious}
				?has-next=${bar.clippedRight}
				.segment=${bar.segment}
			></mitra-entry-segment>
		`
	}

	private headerTemplate(events: Array<TimelineBar>) {
		const { days, offset } = this.dates.window
		const todayValue = new DateTime().dayStart.valueOf()
		// The window's days grouped into contiguous month stretches, each a column-spanning header cell.
		const months = new Array<{ column: number, span: number, label: string }>()
		for (const [index, day] of days.entries()) {
			const previous = days[index - 1]
			if (!previous || day.month !== previous.month) {
				months.push({ column: offset + index, span: 1, label: day.format({ month: 'long', year: 'numeric' }) })
			} else {
				months.at(-1)!.span++
			}
		}
		return html`
			<div class="header">
				${months.map(month => html`
					<div class="month" style="grid-column: ${month.column + 1} / span ${month.span};">
						<span>${month.label}</span>
					</div>
				`)}
				${repeat(days, day => day.dayStart.toISOString(), (day, index) => html`
					<div class="day"
						style="grid-column: ${offset + index + 1};"
						?data-week-start=${day.dayOfWeek === 1}
						?data-today=${day.dayStart.valueOf() === todayValue}
					><span>${day.day}</span></div>
				`)}
				<div class="events">
					${repeat(events, bar => bar.segment.entry, bar => this.barTemplate(bar))}
				</div>
			</div>
		`
	}

	private backdropTemplate(events: Array<TimelineBar>) {
		const { days, offset } = this.dates.window
		const todayValue = new DateTime().dayStart.valueOf()
		// Only the window gets real cells; every other buffer day is just its (empty) grid track — the
		// cells are placed explicitly, so scroll geometry doesn't depend on what's rendered.
		return html`
			<div class="backdrop">
				${repeat(days, day => day.dayStart.toISOString(), (day, index) => html`
					<div class="day"
						data-date=${day.dayStart.toISOString()}
						style="grid-column: ${offset + index + 1};"
						?data-month-start=${day.day === 1}
						?data-today=${day.dayStart.valueOf() === todayValue}
					></div>
				`)}
				${events.map(bar => html`
					<div class="shade" style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.span}`, '--_shade-color': bar.segment.entry.color ?? getSource(bar.segment.entry.sourceId)?.color ?? '' })}></div>
				`)}
			</div>
		`
	}

	private entriesTemplate(tasks: Array<TimelineBar>) {
		return html`
			<div class="entries">
				${repeat(tasks, bar => bar.segment.entry, bar => this.barTemplate(bar))}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-timeline': Timeline
	}
}
