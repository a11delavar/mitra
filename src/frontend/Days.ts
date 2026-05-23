import { Component, component, html, property, css } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { CalendarEvent } from 'shared'

@component('mitra-days')
export class Days extends Component {
	@property({ type: Array }) days = new Array<DateTime>()
	@property({ type: Array }) events = new Array<CalendarEvent>()
	@property({ type: Boolean, reflect: true }) hideTimeAxis = false

	private get eventsByDay() {
		const allItems = this.events.flatMap(e => e.items)
		return this.days.map(day => ({ day, events: allItems.filter(e => e.fallsOnDay(day)) }))
	}

	private getDayGridName(day: DateTime) {
		return `day-${day.toJSON().split('T')[0]}`
	}

	private get gridColumnsStyle() {
		return `var(--time-axis-width) ${this.days.map(day => `[${this.getDayGridName(day)}] minmax(0, 1fr)`).join(' ')}`
	}

	static override get styles() {
		return css`
			:host {
				display: block;
				height: 100%;
				min-height: 0;
				--time-axis-width: 3.75rem;
			}

			.calendar-container {
				display: grid;
				/* gridColumnsStyle is injected inline via style attribute on the wrapper now */
				grid-template-rows: auto minmax(0, 1fr);
				height: 100%;
				overflow-y: auto;
				overflow-x: auto;
				--minute-height: calc(100% / 1440);

				&[data-hide-time-axis] {
					--time-axis-width: 0px;

					.header-timezone, .time-axis, .grid-lines {
						display: none;
					}
				}
			}

			.header-timezone {
				grid-column: 1;
				grid-row: 1;
				position: sticky;
				top: 0;
				inset-inline-start: 0;
				z-index: 200;
				background-color: var(--bg);
				border-bottom: var(--border);
				border-inline-end: var(--border);
				padding: 0.625rem 0;
				text-align: center;
				color: var(--text-muted);
				font-size: 0.8rem;
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
				background-color: var(--bg);
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
				color: var(--text-muted);
				text-align: end;
				padding-inline-end: 0.5rem;
				transform: translateY(-50%);
			}

			.hour-line {
				border-top: var(--border);
				grid-column: 1 / -1;
			}
		`
	}

	protected override get template() {
		const today = new DateTime()
		return html`
			<div class="calendar-container" ?data-hide-time-axis=${this.hideTimeAxis} style="grid-template-columns: ${this.gridColumnsStyle};">
				<div class="header-timezone">${today.formatToParts({ timeZoneName: 'shortOffset' }).find(x => x.type === 'timeZoneName')?.value}</div>

				${this.timeAxisTemplate}

				${this.eventsByDay.map(data => html`
					<mitra-day
						style="grid-column: ${this.getDayGridName(data.day)};"
						.date=${data.day}
						.events=${data.events}
						?today=${data.day.dayStart.equals(today.dayStart)}
					></mitra-day>
				`)}
			</div>
		`
	}

	private get timeAxisTemplate() {
		const reference = this.days[0]
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
