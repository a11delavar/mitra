import { Component, component, html, property, css, type PropertyValues, repeat, event, ifDefined, styleMap } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { type Entry } from 'shared'
import { EntrySegments, type MonthWeek } from './EntrySegments.js'
import { EntryConnections } from './EntryConnections.js'
import { CalendarDatesController } from './CalendarDatesController.js'
import { EntryDragController } from './EntryDragController.js'

/** The month view's grid: a vertically-scrolling strip of week rows — named, like `Days` (the week
 * view's strip of day columns), after the unit it strips. */
@component('mitra-weeks')
export class Weeks extends Component {
	@event({ bubbles: true, composed: true }) readonly navigate!: EventDispatcher<DateTime>
	@event({ bubbles: true, composed: true }) readonly switchToWeek!: EventDispatcher

	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	private static readonly MAX_SLOTS = 4

	// A taller render window than the day view's default: month rows are short, so a tall viewport
	// shows many weeks — the radius must stay comfortably ahead of it (see CalendarDatesController.window).
	private readonly buffer: CalendarDatesController = new CalendarDatesController(this, { radiusDays: 77, shiftDays: 14 })
	protected readonly entryDrag = new EntryDragController(this, 'month')

	private get bufferNavigatingDate(): DateTime { return this.buffer.navigatingDate }
	private get days(): Array<DateTime> { return this.buffer.days }
	private get segments(): EntrySegments { return EntrySegments.of(this.entries, this.buffer.window.days) }

	protected override initialized() {
		this.buffer.navigatingDate = this.navigatingDate
		this.buffer.scrollToDate(this.navigatingDate)
	}

	protected override updated(props: PropertyValues<this>) {
		if (props.has('navigatingDate') && !this.navigatingDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.buffer.navigatingDate = this.navigatingDate
			this.buffer.scrollToDate(this.navigatingDate)
		}
	}

	private handleScroll(e: Event) {
		const target = e.target as HTMLElement
		const daysInWeek = this.navigatingDate.daysInWeek
		const rowCount = this.days.length / daysInWeek

		const rowHeight = target.scrollHeight / rowCount
		const centerRow = Math.floor((target.scrollTop + target.clientHeight / 2) / rowHeight)
		const centerDate = this.days[Math.min(centerRow * daysInWeek, this.days.length - 1)]

		if (centerDate && !centerDate.monthStart.equals(this.buffer.navigatingDate.monthStart)) {
			this.buffer.navigatingDate = centerDate
		}
	}

	private get weekDays() {
		return CalendarDatesController.sampleWeek.map(d => d.format({ weekday: 'short' }))
	}

	static override get styles() {
		return css`
			mitra-weeks {
				display: flex;
				flex-direction: column;
				background-color: var(--color-border);
				flex: 1;
				min-height: 0;

				& > .headers {
					display: grid;
					grid-template-columns: repeat(7, 1fr);
					z-index: 200;
				}

				.weekday {
					padding: 0.5rem;
					text-align: center;
					font-size: 0.8rem;
					font-weight: 500;
					color: var(--color-text-muted);
				}

				.days {
					flex: 1;
					min-height: 0;
					overflow-y: auto;
					scrollbar-width: none;
					overflow-anchor: auto;
					&::-webkit-scrollbar {
						display: none;
					}
				}

				/* The month grid, wrapped in the POSITIONED, co-scrolling canvas that makes the bars
				   anchorable by the connections layer (the same pattern as the week view's canvas —
				   see Days.ts; the scroller itself must NOT be the containing block). Not a stacking
				   context: the bars' z 2 and the connectors' z 1 interleave in the view's context. */
				.canvas {
					display: grid;
					grid-template-columns: repeat(7, 1fr);
					gap: 1px;
					min-block-size: 100%;
					position: relative;
				}

				.week {
					grid-column: 1 / -1;
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: 1.75rem repeat(var(--max-slots), 1.375rem) 1fr;
					row-gap: 0.125rem;

					mitra-day {
						grid-row: 1 / -1;
						container-type: size;
					}

					> mitra-entry-segment {
						z-index: 2;
						align-self: stretch;
						margin-top: 0 !important;
						flex-direction: row !important;
						align-items: center !important;
						gap: 0.375rem !important;
						padding: 0 0.375rem !important;

						> .time {
							display: block !important;
							.separator, .end { display: none !important; }
						}

						> .heading {
							flex: 1 !important;
							white-space: nowrap !important;
							overflow: hidden !important;
							text-overflow: ellipsis !important;
						}
					}

					> .more {
						grid-row: calc(var(--max-slots) + 1);
						z-index: 2;
						font-size: 0.7rem;
						font-weight: 500;
						color: var(--color-text-muted);
						cursor: pointer;
						padding: 0 0.375rem;
						align-self: center;

						&:hover {
							color: var(--color-text);
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const today = new DateTime().dayStart
		const daysInWeek = this.navigatingDate.daysInWeek
		const weeks = new Array<Array<DateTime>>()
		for (let i = 0; i < this.days.length; i += daysInWeek) {
			weeks.push(this.days.slice(i, i + daysInWeek))
		}

		// Only the weeks intersecting the render window get real content, each placed at its explicit
		// row; the trailing spacer forces the implicit grid to its full week count, so the scrollbar
		// (and the scroll-position→date math above) never depends on what's rendered.
		const { days: windowDays, offset } = this.buffer.window
		const firstWeek = Math.floor(offset / daysInWeek)
		const lastWeek = windowDays.length ? Math.floor((offset + windowDays.length - 1) / daysInWeek) : firstWeek

		// Week layouts computed once per render: the bars feed both the rows and the connections layer
		// (which must see exactly the RENDERED bars — "+N more" overflow excluded, so no edge can
		// reference an anchor that doesn't exist).
		const rendered = weeks.slice(firstWeek, lastWeek + 1).map((week, index) => ({
			week,
			row: firstWeek + index,
			...this.segments.monthWeek(week, Weeks.MAX_SLOTS) as MonthWeek,
		}))

		return html`
			<div class="headers">
				${this.weekDays.map(weekday => html`<div class="weekday">${weekday}</div>`)}
			</div>
			<div class="days" @scroll=${this.handleScroll}>
				<div class="canvas" style="grid-auto-rows: minmax(8.5rem, 1fr); --max-slots: ${Weeks.MAX_SLOTS};">
					${repeat(rendered, item => item.week[0]!.dayStart.toISOString(), item => this.weekTemplate(item, today))}
					${!weeks.length ? html.nothing : html`<div style="grid-row: ${weeks.length};"></div>`}
					${!EntryConnections.isEnabledFor('month') ? html.nothing : html`
						<mitra-entry-connections
							.segments=${rendered.flatMap(item => item.bars.map(bar => bar.segment))}
							.verticalRank=${new Map(rendered.flatMap(item => item.bars.map(bar => [bar.segment, item.row * 100 + bar.slot] as const)))}
						></mitra-entry-connections>
					`}
				</div>
			</div>
		`
	}

	private weekTemplate({ week, row, bars, hiddenByColumn }: { week: Array<DateTime>, row: number, bars: MonthWeek['bars'], hiddenByColumn: MonthWeek['hiddenByColumn'] }, today: DateTime) {
		return html`
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
				${repeat(bars, bar => bar.segment.entry, bar => html`
					<mitra-entry-segment
						style=${styleMap({ gridColumn: `${bar.startColumn + 1} / span ${bar.span}`, gridRow: `${bar.slot + 2}` })}
						resize=${ifDefined(bar.segment.entry.allDay ? 'inline' : undefined)}
						?has-previous=${bar.segment.hasPrevious}
						?has-next=${bar.clippedRight}
						.segment=${bar.segment}
					></mitra-entry-segment>
				`)}
				${hiddenByColumn.map((count, col) => !count ? html.nothing : html`
					<div class="more" style="grid-column: ${col + 1};" @click=${() => { this.navigate.dispatch(week[col]!); this.switchToWeek.dispatch() }}>${t('+${count:number} more', { count })}</div>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-weeks': Weeks
	}
}
