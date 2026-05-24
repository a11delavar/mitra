import { Component, component, html, property, css, type PropertyValues, repeat } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { CalendarEvent, EventSegment } from 'shared'
import { CalendarDatesController } from './CalendarDatesController.js'

@component('mitra-month')
export class Month extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) events = new Array<CalendarEvent>()

	private readonly buffer = new CalendarDatesController(this)

	private get bufferNavigatingDate(): DateTime { return this.buffer.navigatingDate }
	private get days(): Array<DateTime> { return this.buffer.days }

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

				.headers {
					display: grid;
					grid-template-columns: repeat(7, 1fr);
					gap: 1px;
					background-color: var(--color-border);
					z-index: 200;
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

				.weekday {
					background-color: var(--color-background);
					padding: 0.5rem;
					text-align: center;
					font-size: 0.75rem;
					font-weight: 600;
					color: var(--color-text);
					text-transform: uppercase;
				}

				mitra-day {
					container-type: size;
					height: 100%;

					mitra-event {
						grid-row: var(--month-slot, auto) !important;
						--overlap-slot: 0 !important;
						--overlap-total: 1 !important;
						--overlap-span: 1 !important;

						flex-direction: row !important;
						align-items: center !important;
						gap: 0.375rem !important;
						padding: 0.125rem 0.375rem !important;

						.time {
							display: block !important;
							.separator, .end {
								display: none !important;
							}
						}

						.heading {
							flex: 1 !important;
							white-space: nowrap !important;
							overflow: hidden !important;
							text-overflow: ellipsis !important;
							display: block !important;
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const today = new DateTime().dayStart
		const MAX_SLOTS = 4

		const allClusteredSegments = EventSegment.clusterMonth(this.events.flatMap(e => e.segments))

		const getDayData = (date: DateTime) => {
			const daySegments = allClusteredSegments.filter(s => s.segmentDate?.dayStart.equals(date.dayStart))
			const visible = daySegments.filter(s => s.monthSlot !== undefined && s.monthSlot < MAX_SLOTS - 1)
			const hiddenEventsCount = daySegments.length - visible.length
			return { visible, hiddenEventsCount }
		}

		return html`
			<div class="headers">
				${this.weekDays.map(weekday => html`<div class="weekday">${weekday}</div>`)}
			</div>
			<div class="days" @scroll=${this.handleScroll} style="grid-template-rows: repeat(${this.days.length / this.navigatingDate.daysInWeek}, minmax(8.5rem, 1fr));">
				${repeat(this.days, day => day.dayStart.toISOString(), day => {
					const { visible, hiddenEventsCount } = getDayData(day)
					return html`
						<mitra-day
							data-date=${day.dayStart.toISOString()}
							.date=${day}
							.events=${visible}
							.hiddenEventsCount=${hiddenEventsCount}
							style="--max-slots: ${MAX_SLOTS}"
							?today=${day.dayStart.equals(today)}
							?data-with-background=${day.month === this.bufferNavigatingDate.month}>
						</mitra-day>
					`
				})}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-month': Month
	}
}
