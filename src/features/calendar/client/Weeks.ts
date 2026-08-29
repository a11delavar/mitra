import { Component, component, html, property, css, type PropertyValues, repeat, guard, event, ifDefined, styleMap, query } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Entry } from '../../entries/Entry.js'
import { EntrySegments, type MonthWeek } from '../../entries/client/EntrySegments.js'
import { EntryConnections } from '../../relations/client/EntryConnections.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { CalendarScrollController } from './CalendarScrollController.js'
import { EntryDragController } from '../../entries/client/EntryDragController.js'
import { WeeksDensityController } from './WeeksDensityController.js'
import { Routines, type RoutineRun } from '../../routines/client/Routines.js'

type RenderedWeek = { week: ReadonlyArray<DateTime>, row: number, runs: ReadonlyArray<RoutineRun> } & MonthWeek

/**
 * Month view calendar grid displaying vertically scrolling strip of week rows.
 */
@component('mitra-weeks')
export class Weeks extends Component {
	@event({ bubbles: true, composed: true }) readonly navigate!: EventDispatcher<DateTime>
	@event({ bubbles: true, composed: true }) readonly switchToWeek!: EventDispatcher

	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	private readonly buffer: CalendarDatesController = new CalendarDatesController(this, { radiusDays: 77, shiftDays: 14 })
	protected readonly entryDrag = new EntryDragController(this, 'month')
	protected readonly density = new WeeksDensityController(this)

	private get bufferNavigatingDate(): DateTime { return this.buffer.navigatingDate }
	private get days(): Array<DateTime> { return this.buffer.days }
	private get routines(): Routines { return Routines.of(this.entries, this.buffer.window.days, 'week') }

	private get segments(): EntrySegments { return EntrySegments.of(this.routines.kept, this.buffer.window.days) }

	private weekLayouts: { cohort?: Routines, byWeek: Map<number, RenderedWeek> } = { byWeek: new Map() }

	@query('.days') private readonly daysElement?: HTMLElement

	private get metrics() {
		const scroller = this.daysElement
		const daysInWeek = this.navigatingDate.daysInWeek
		const rowCount = this.days.length / daysInWeek
		const pitch = !scroller || !rowCount ? 0 : scroller.scrollHeight / rowCount
		const centerRows = !scroller || !(pitch > 0) ? 0 : Math.floor(scroller.clientHeight / 2 / pitch)
		return { daysInWeek, rowCount, pitch, centerRows }
	}

	private readonly scrolling: CalendarScrollController = new CalendarScrollController(this, this.buffer, {
		axis: 'block',
		scroller: () => this.daysElement ?? null,
		ready: () => this.days.length > 0,
		suspended: () => this.density.active,
		offsetOf: date => {
			const first = this.days[0]
			const { daysInWeek, pitch, centerRows } = this.metrics
			if (!first || !(pitch > 0)) {
				return undefined
			}
			const index = Math.round((date.dayStart.valueOf() - first.dayStart.valueOf()) / 86_400_000)
			return (Math.floor(index / daysInWeek) - centerRows) * pitch
		},
		dateAt: offset => {
			const { daysInWeek, rowCount, pitch, centerRows } = this.metrics
			if (!(pitch > 0)) {
				return undefined
			}
			const centerRow = Math.round(offset / pitch) + centerRows
			return this.days[Math.min(Math.max(0, centerRow), rowCount - 1) * daysInWeek]
		},
		equivalent: (a, b) => a.weekStart.dayStart.equals(b.weekStart.dayStart) || a.monthStart.dayStart.equals(b.monthStart.dayStart),
	})

	protected override initialized() {
		this.scrolling.navigate(this.navigatingDate)
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.scrolling.navigate(this.navigatingDate)
		}
		this.toggleAttribute('data-week-numbers', this.weekNumbers)
	}

	private get weekNumbers() {
		return this.navigatingDate.weekOfYear !== undefined
	}

	private get weekDays() {
		return CalendarDatesController.sampleWeek.map(d => d.format({ weekday: 'short' }))
	}

	static override get styles() {
		return css`
			@property --_weeks-strip-height {
				syntax: '<length>';
				inherits: false;
				initial-value: 0px;
			}

			@property --_ideal-week-height {
				syntax: '<length>';
				inherits: false;
				initial-value: 136px;
			}

			@property --_weeks-strip-width {
				syntax: '<length>';
				inherits: false;
				initial-value: 0px;
			}

			@property --_week-rail-width {
				syntax: '<length>';
				inherits: true;
				initial-value: 0px;
			}

			@property --_month-density {
				syntax: '<number>';
				inherits: true;
				initial-value: 1;
			}

			mitra-weeks {
				display: flex;
				flex-direction: column;
				background-color: var(--color-background);
				flex: 1;
				min-height: 0;
				--_week-rail-width: 0px;

				&[data-week-numbers] {
					--_week-rail-width: 1.75rem;
				}

				touch-action: pan-x pan-y;

				& > .headers {
					display: grid;
					grid-template-columns: var(--_week-rail-width) repeat(7, 1fr);
					column-gap: 1px;
					z-index: 200;
				}

				.corner {
					user-select: none;
				}

				.weekday {
					padding: 0.5rem;
					text-align: center;
					font-size: 0.8rem;
					font-weight: 500;
					color: var(--color-text-muted);
				}

				& > .body {
					flex: 1;
					min-height: 0;
					container-type: size;
				}

				.days {
					height: 100%;
					overflow-y: auto;
					scroll-snap-type: block mandatory;
					scrollbar-width: none;
					overflow-anchor: auto;
					&::-webkit-scrollbar {
						display: none;
					}
				}

				.canvas {
					display: grid;
					grid-template-columns: var(--_week-rail-width) repeat(7, 1fr);
					--_weeks-strip-height: 100cqb;
					--_ideal-week-height: calc(8.5rem * var(--month-zoom, 1));
					--_visible-weeks: max(2, round(down, tan(atan2(var(--_weeks-strip-height), var(--_ideal-week-height))), 1));
					--_month-density: clamp(0, calc(tan(atan2(var(--_weeks-strip-width) - var(--_week-rail-width) - 24rem, 1px)) / tan(atan2(56rem - 24rem, 1px))), 1);
					--_weeks-strip-width: 100cqi;
					grid-auto-rows: max(var(--_ideal-week-height), calc((var(--_weeks-strip-height) + 1px) / var(--_visible-weeks) - 1px));
					gap: 1px;

					mitra-weeks[data-zooming] & {
						grid-auto-rows: var(--_ideal-week-height);
					}

					min-block-size: 100%;
					position: relative;
				}

				.canvas > .week-number {
					grid-column: 1;
					position: sticky;
					inset-inline-start: 0;
					z-index: 110;
					background-color: var(--color-background);
					border-inline-end: var(--border);
					font-size: calc(0.65rem + 0.1rem * var(--_month-density));
					font-weight: 600;
					font-variant-numeric: tabular-nums;
					color: var(--color-text-muted);
					cursor: pointer;
					user-select: none;

					&:hover {
						color: var(--color-text);
					}

					> span {
						position: sticky;
						inset-block-start: 0;
						display: block;
						text-align: center;
						padding-block: 0.375rem;
					}
				}

				.week {
					grid-column: 2 / -1;
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: calc(1.375rem + 0.375rem * var(--_month-density)) 1fr;
					row-gap: 0.125rem;
					scroll-snap-align: var(--scroll-snap-align);

					mitra-day {
						grid-row: 1 / -1;
						container-type: size;
					}

					> .entries {
						grid-column: 1 / -1;
						grid-row: 2;
						display: grid;
						grid-template-columns: subgrid;
						grid-auto-rows: calc(1.125rem + 0.25rem * var(--_month-density));
						row-gap: 0.125rem;
						min-height: 0;
						overflow: hidden;
						mask-image: linear-gradient(to bottom, black calc(100% - 0.625rem), transparent);
						z-index: 2;
						pointer-events: none;

						> mitra-entry-segment {
							pointer-events: auto;
							z-index: 2;
							align-self: stretch;
							margin-top: 0 !important;
							flex-direction: row !important;
							align-items: center !important;
							gap: calc(0.25rem + 0.125rem * var(--_month-density)) !important;
							padding: 0 calc(0.25rem + 0.125rem * var(--_month-density)) !important;
							border-inline-start-width: calc(2px + 1px * var(--_month-density));

							> .heading {
								flex: 1 !important;
								white-space: nowrap !important;
								overflow: hidden !important;
								text-overflow: ellipsis !important;
							}
						}

						> .routines {
							grid-column: 1 / -1;
							display: grid;
							grid-template-columns: subgrid;
							grid-auto-rows: 0.125rem;
							grid-auto-flow: row dense;
							gap: 2px;
							align-content: start;
							max-block-size: 100%;
							padding-block-start: 0.25rem;
							overflow: clip;
							pointer-events: none;

							> mitra-entry-segment {
								pointer-events: auto;
							}
						}
					}

					mitra-day .header .day {
						font-size: calc(0.75rem + 0.125rem * var(--_month-density));

						&[data-today] {
							min-width: calc(1.25rem + 0.25rem * var(--_month-density));
							min-height: calc(1.25rem + 0.25rem * var(--_month-density));
							padding: calc(0.1rem + 0.1rem * var(--_month-density)) calc(0.3rem + 0.1rem * var(--_month-density));
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const today = new DateTime().dayStart
		const todayValue = today.valueOf()
		const monthValue = this.bufferNavigatingDate.monthStart.dayStart.valueOf()
		const daysInWeek = this.navigatingDate.daysInWeek
		const weeks = new Array<Array<DateTime>>()
		for (let i = 0; i < this.days.length; i += daysInWeek) {
			weeks.push(this.days.slice(i, i + daysInWeek))
		}

		const { days: windowDays, offset } = this.buffer.window
		const firstWeek = Math.floor(offset / daysInWeek)
		const lastWeek = windowDays.length ? Math.floor((offset + windowDays.length - 1) / daysInWeek) : firstWeek

		const routines = this.routines
		if (this.weekLayouts.cohort !== routines) {
			this.weekLayouts = { cohort: routines, byWeek: new Map() }
		}
		const rendered = weeks.slice(firstWeek, lastWeek + 1).map((week, index) => {
			const key = week[0]!.dayStart.valueOf()
			let item = this.weekLayouts.byWeek.get(key)
			if (!item) {
				item = {
					week,
					row: firstWeek + index,
					runs: routines.runsIn(week[0]!, week[week.length - 1]!),
					...this.segments.monthWeek(week) as MonthWeek,
				}
				this.weekLayouts.byWeek.set(key, item)
			}
			return item
		})

		return html`
			<div class="headers" data-chrome>
				<div class="corner"></div>
				${this.weekDays.map(weekday => html`<div class="weekday">${weekday}</div>`)}
			</div>
			<div class="body">
				<div class="days">
					<div class="canvas">
						${repeat(rendered, item => item.week[0]!.dayStart.toISOString(), item =>
							guard([item, todayValue, monthValue], () => this.weekTemplate(item, today)))}
						${!weeks.length ? html.nothing : html`<div style="grid-row: ${weeks.length};"></div>`}
						${!EntryConnections.isEnabledFor('month') ? html.nothing : html`
							<mitra-entry-connections draft-host
								.segments=${rendered.flatMap(item => item.bars.map(bar => bar.segment))}
								.placement=${new Map(rendered.flatMap(item => item.bars.map(bar => [bar.segment, {
									start: bar.startColumn,
									end: bar.startColumn + bar.span - 1,
									rank: item.row * 1000 + bar.slot,
								}] as const)))}
							></mitra-entry-connections>
						`}
					</div>
				</div>
			</div>
		`
	}

	private weekTemplate({ week, row, bars, runs }: RenderedWeek, today: DateTime) {
		const columnByDay = new Map(week.map((day, index) => [day.dayStart.valueOf(), index]))
		const columnOf = (dayValue: number) => columnByDay.get(dayValue) ?? 0
		const routineRow = bars.reduce((lanes, bar) => Math.max(lanes, bar.slot + 1), 0) + 1
		const weekNumber = week[0]!.weekOfYear
		return html`
			${weekNumber === undefined ? html.nothing : html`
				<div class="week-number" data-chrome style="grid-row: ${row + 1};"
					title=${t('Week ${week:number}', { week: weekNumber })}
					@click=${() => { this.navigate.dispatch(week[0]!); this.switchToWeek.dispatch() }}
				><span>${weekNumber.format()}</span></div>
			`}
			<div class="week" style="grid-row: ${row + 1};">
				${week.map((day, col) => html`
					<mitra-day
						data-date=${day.dayStart.toISOString()}
						style="grid-column: ${col + 1};"
						.date=${day}
						?today=${day.dayStart.equals(today)}
						?data-with-background=${day.month === this.bufferNavigatingDate.month}>
					</mitra-day>
				`)}
				<div class="entries">
					${repeat(bars, bar => bar.segment.entry, bar => html`
						<mitra-entry-segment
							style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.span}`, gridRow: `${bar.slot + 1}` })}
							resize=${ifDefined(bar.segment.entry.allDay ? 'inline' : undefined)}
							?has-previous=${bar.segment.hasPrevious}
							?has-next=${bar.clippedRight}
							.segment=${bar.segment}
						></mitra-entry-segment>
					`)}
					${!runs.length ? html.nothing : html`
						<div class="routines" style="grid-row: ${routineRow};">
							${repeat(runs, run => run.segment.id, run => {
								const columns = run.days.map(columnOf)
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
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-weeks': Weeks
	}
}
