import { Component, component, html, property, css, repeat, type PropertyValues, eventListener } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { CalendarEvent } from 'shared'
import { CalendarDatesController } from './CalendarDatesController.js'

@component('mitra-days')
export class Days extends Component {
	@property({ type: Object }) navigatingDate = new DateTime()
	@property({ type: Array }) events = new Array<CalendarEvent>()
	@property({ type: Boolean, reflect: true }) hideTimeAxis = false

	private readonly buffer = new CalendarDatesController(this)
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
		this.style.setProperty('--_days-length', this.days.length.toString())
	}

	@eventListener('scroll')
	protected handleScroll(e: Event) {
		const target = e.target as HTMLElement
		const timeAxisWidth = 60 // ~3.75rem
		const colWidth = (target.scrollWidth - timeAxisWidth) / this.days.length

		// The browser centers the element within the "snapport", which excludes the time axis.
		// So we must calculate the center pixel of the snapport, not the whole client area.
		const snapportCenterOffset = timeAxisWidth + (target.clientWidth - timeAxisWidth) / 2
		const centerPixel = target.scrollLeft + snapportCenterOffset

		const centerCol = Math.floor((centerPixel - timeAxisWidth) / colWidth)
		const centerDate = this.days[Math.min(Math.max(0, centerCol), this.days.length - 1)]

		if (centerDate && !centerDate.dayStart.equals(this.buffer.navigatingDate.dayStart)) {
			this.buffer.navigatingDate = centerDate
		}
	}

	static override get styles() {
		return css`
			mitra-days {
				display: grid;
				grid-template-rows: auto minmax(0, 1fr);
				grid-template-columns: var(--time-axis-width) repeat(var(--_days-length), minmax(14.375rem, 1fr));
				height: 100%;
				min-height: 0;
				--time-axis-width: 3.75rem;
				container-type: inline-size;
				overflow-y: auto;
				overflow-x: auto;
				scroll-snap-type: x proximity;
				scroll-padding-inline-start: var(--time-axis-width);
				scrollbar-width: none; /* Firefox */
				--minute-height: calc(100% / 1440);

				&::-webkit-scrollbar {
					display: none; /* Chrome/Safari */
				}

				&[hideTimeAxis] {
					--time-axis-width: 0px;

					.header-timezone, .time-axis, .grid-lines {
						display: none;
					}
				}

				.header-timezone {
					grid-column: 1;
					grid-row: 1;
					position: sticky;
					top: 0;
					inset-inline-start: 0;
					z-index: 200;
					background-color: var(--color-background);
					border-bottom: var(--border);
					border-inline-end: var(--border);
					padding: 0.625rem 0;
					text-align: center;
					color: var(--color-text-muted);
					font-size: 0.8rem;
				}

				mitra-day {
					grid-row: 1 / -1;
					grid-template-rows: subgrid;
					scroll-snap-align: start;
				}

				.time-axis {
					grid-column: 1;
					grid-row: 2;
					display: grid;
					grid-template-rows: repeat(1440, var(--minute-height));
					height: 100%;
					border-inline-end: var(--border);
					position: sticky;
					inset-inline-start: 0;
					z-index: 90;
					background-color: var(--color-background);
				}

				.grid-lines {
					grid-column: 2 / -1;
					grid-row: 2;
					display: grid;
					grid-template-rows: repeat(1440, var(--minute-height));
					height: 100%;
					pointer-events: none;
					z-index: 0;
				}

				.time-slot-label {
					font-size: 0.75rem;
					color: var(--color-text-muted);
					text-align: end;
					padding-inline-end: 0.5rem;
					transform: translateY(-50%);
				}

				.hour-line {
					border-top: var(--border);
					grid-column: 1 / -1;
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const today = new DateTime()
		const allItems = this.events.flatMap(e => e.items)
		const getEventsForDay = (date: DateTime) => {
			const dayEvents = allItems.filter(e => e.fallsOnDay(date))
			return dayEvents.length ? CalendarEvent.cluster(dayEvents) : []
		}

		return html`
			<div class="header-timezone">${today.formatToParts({ timeZoneName: 'shortOffset' }).find(x => x.type === 'timeZoneName')?.value}</div>

			${this.timeAxisTemplate}

			${repeat(this.days, day => day.dayStart.toISOString(), (day, index) => html`
				<mitra-day
					data-date=${day.dayStart.toISOString()}
					style="grid-column: ${index + 2};"
					.date=${day}
					.events=${getEventsForDay(day)}
					?today=${day.dayStart.equals(today.dayStart)}
				></mitra-day>
			`)}
		`
	}

	private get timeAxisTemplate() {
		const reference = this.days[0] || new DateTime()
		return html`
			<div class="time-axis">
				${Array.from({ length: reference.hoursInDay }).map((_, i) => html`
					<div class="time-slot-label" style="grid-row: ${i * 60 + 1};">
						${i === 0 || !reference ? '' : reference.with({ hour: i, minute: 0, second: 0, millisecond: 0 }).format({ hour: '2-digit', minute: '2-digit', hour12: false })}
					</div>
				`)}
			</div>

			<div class="grid-lines">
				${Array.from({ length: reference.hoursInDay }).map((_, i) => html`
					<div class="hour-line" style="grid-row: ${i * 60 + 1};"></div>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-days': Days
	}
}
