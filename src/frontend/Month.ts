import { Component, component, html, property, css, type PropertyValues, repeat, event } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { Entry } from 'shared'
import { EntrySegments } from './EntrySegments.js'
import { CalendarDatesController } from './CalendarDatesController.js'

@component('mitra-month')
export class Month extends Component {
	@event({ bubbles: true, composed: true }) readonly navigate!: EventDispatcher<DateTime>
	@event({ bubbles: true, composed: true }) readonly switchToWeek!: EventDispatcher

	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) entries = new Array<Entry>()

	private static readonly MAX_SLOTS = 4

	private readonly buffer = new CalendarDatesController(this)

	private get bufferNavigatingDate(): DateTime { return this.buffer.navigatingDate }
	private get days(): Array<DateTime> { return this.buffer.days }
	private get segments() { return EntrySegments.of(this.entries, this.days) }

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
			mitra-month {
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
					display: grid;
					grid-template-columns: repeat(7, 1fr);
					gap: 1px;
					flex: 1;
					min-height: 0;
					overflow-y: auto;
					scrollbar-width: none;
					overflow-anchor: auto;
					&::-webkit-scrollbar {
						display: none;
					}
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

		return html`
			<div class="headers">
				${this.weekDays.map(weekday => html`<div class="weekday">${weekday}</div>`)}
			</div>
			<div class="days" @scroll=${this.handleScroll} style="grid-auto-rows: minmax(8.5rem, 1fr); --max-slots: ${Month.MAX_SLOTS};">
				${repeat(weeks, week => week[0]!.dayStart.toISOString(), week => this.weekTemplate(week, today))}
			</div>
		`
	}

	private weekTemplate(week: Array<DateTime>, today: DateTime) {
		const { bars, hiddenByColumn } = this.segments.monthWeek(week, Month.MAX_SLOTS)
		return html`
			<div class="week">
				${week.map((day, col) => html`
					<mitra-day
						data-date=${day.dayStart.toISOString()}
						style="grid-column: ${col + 1};"
						.date=${day}
						?today=${day.dayStart.equals(today)}
						?data-with-background=${day.month === this.bufferNavigatingDate.month}>
					</mitra-day>
				`)}
				${bars.map(bar => html`
					<mitra-entry-segment
						style="grid-column: ${bar.startColumn + 1} / span ${bar.span}; grid-row: ${bar.slot + 2};"
						.segment=${bar.segment}
					></mitra-entry-segment>
				`)}
				${hiddenByColumn.map((count, col) => !count ? html.nothing : html`
					<div class="more" style="grid-column: ${col + 1};" @click=${() => { this.navigate.dispatch(week[col]!); this.switchToWeek.dispatch() }}>+${count} more</div>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-month': Month
	}
}
