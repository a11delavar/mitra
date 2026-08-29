import { Component, component, html, property, css, repeat, guard, type PropertyValues, event, styleMap, ifDefined, query } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Entry } from '../../entries/Entry.js'
import { EntrySegments } from '../../entries/client/EntrySegments.js'
import { CalendarDatesController, type CalendarMonth } from './CalendarDatesController.js'
import { CalendarScrollController } from './CalendarScrollController.js'
import { EntryDragController } from '../../entries/client/EntryDragController.js'
import { MonthsDensityController } from './MonthsDensityController.js'
import { Routines } from '../../routines/client/Routines.js'

/**
 * Year view months strip with one row per month aligned across weekday columns.
 */
@component('mitra-months')
export class Months extends Component {
	@event({ bubbles: true, composed: true }) readonly navigate!: EventDispatcher<DateTime>
	@event({ bubbles: true, composed: true }) readonly switchToMonth!: EventDispatcher

	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	private readonly buffer: CalendarDatesController = new CalendarDatesController(this, { radiusDays: 300, shiftDays: 28, triggerWeeks: 52, bufferWeeks: 520 })
	protected readonly entryDrag = new EntryDragController(this, 'year')
	protected readonly density = new MonthsDensityController(this)

	@query('.corner') private readonly corner?: HTMLElement
	@query('mitra-day') private readonly dayCell?: HTMLElement

	private get routines(): Routines { return Routines.of(this.entries, this.buffer.window.days, 'month') }

	private get segments(): EntrySegments { return EntrySegments.of(this.routines.kept, this.buffer.window.days) }

	private get columns() { return 31 + this.navigatingDate.daysInWeek - 1 }

	private get metrics() {
		const headerHeight = this.corner?.clientHeight ?? 0
		const cell = this.dayCell
		const pitch = cell ? cell.getBoundingClientRect().height + 1 : (this.scrollHeight - headerHeight) / (this.buffer.months.length || 1)
		return { headerHeight, pitch }
	}

	private readonly scrolling: CalendarScrollController = new CalendarScrollController(this, this.buffer, {
		axis: 'block',
		scroller: () => this,
		ready: () => this.buffer.months.length > 0,
		suspended: () => this.density.active,
		offsetOf: date => {
			const first = this.buffer.months[0]
			const { headerHeight, pitch } = this.metrics
			if (!first || !(pitch > 0)) {
				return undefined
			}
			const row = (date.year - first.first.year) * 12 + date.month - first.first.month
			return headerHeight + (row + 0.5) * pitch - this.clientHeight / 2
		},
		dateAt: offset => {
			const months = this.buffer.months
			const { headerHeight, pitch } = this.metrics
			if (!months.length || !(pitch > 0)) {
				return undefined
			}
			const centerRow = Math.floor((offset + this.clientHeight / 2 - headerHeight) / pitch)
			return months[Math.max(0, Math.min(centerRow, months.length - 1))]?.first
		},
		equivalent: (a, b) => a.monthStart.dayStart.equals(b.monthStart.dayStart),
	})

	protected override initialized() {
		this.scrolling.navigate(this.navigatingDate)
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.scrolling.navigate(this.navigatingDate)
		}
		this.style.setProperty('--_months-count', this.buffer.months.length.toString())
		this.style.setProperty('--_columns-count', this.columns.toString())
	}

	static override get styles() {
		return css`
			mitra-months {
				display: grid;
				grid-template-columns: auto repeat(var(--_columns-count, 37), minmax(1.375rem, 1fr));
				grid-template-rows: 1.75rem repeat(var(--_months-count, 12), var(--month-height));
				--month-height: max(3rem, calc((100% - 1.75rem - 13px) / 12 * var(--months-zoom, 1)));
				gap: 1px;
				height: 100%;
				min-height: 0;
				background-color: var(--color-background);
				overflow: auto;
				overflow-anchor: none;
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

				> mitra-day {
					container-type: size;

					.header {
						position: static;
						inset: auto;
						align-items: center;
						justify-content: center;
						padding: 0.125rem 0;

						.weekday, .month {
							display: none;
						}

						.day {
							font-size: clamp(0.5rem, 22cqi, 0.8rem);
							color: var(--color-text-muted);
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
					padding-block-start: 1.125rem;
					overflow: hidden;
					mask-image: linear-gradient(to bottom, black calc(100% - 0.625rem), transparent);
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

					> .routines {
						grid-column: 1 / -1;
						grid-row: auto / span 2;
						display: grid;
						grid-template-columns: subgrid;
						grid-auto-rows: 0.125rem;
						grid-auto-flow: row dense;
						gap: 2px;
						align-content: start;
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

		return html`
			<div class="corner" data-chrome></div>
			<div class="weekdays" data-chrome>
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
					? guard([month, this.entries, todayValue, index], () => this.monthTemplate(month, index + 2, todayValue))
					: html.nothing)}
		`
	}

	private monthTemplate(month: CalendarMonth, row: number, todayValue: number) {
		return html`
			<div class="label" data-chrome style="grid-row: ${row};" @click=${() => { this.navigate.dispatch(month.first.monthStart.add({ days: 14 })); this.switchToMonth.dispatch() }}>
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
		const segments = this.segments.runsIn(month.first, month.last, () => true)
			.map(segment => ({ segment, rank: EntrySegments.laneRank(segment.entry) }))
			.sort((a, b) => a.rank - b.rank)
			.map(ranked => ranked.segment)
		const runs = this.routines.runsIn(month.first, month.last)
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
				${!runs.length ? html.nothing : html`
					<div class="routines">
						${repeat(runs, run => run.segment.id, run => {
							const columns = run.days.map(day => month.columnOf(day))
							const startColumn = columns[0]!
							return html`
								<mitra-entry-segment
									style=${styleMap({ gridColumn: `${startColumn + 1} / span ${columns.at(-1)! - startColumn + 1}` })}
									.segment=${run.segment}
									.routine=${run}
									.ticks=${columns.map(column => column - startColumn + 1)}
								></mitra-entry-segment>
							`
						})}
					</div>
				`}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-months': Months
	}
}
