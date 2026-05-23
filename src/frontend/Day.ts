import { Component, component, html, property, css } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { CalendarEvent } from 'shared'
import './Event.js'

@component('mitra-day')
export class Day extends Component {
	@property({ type: Object }) date!: DateTime
	@property({ type: Array }) events = new Array<CalendarEvent>()
	@property({ type: Boolean, reflect: true }) today = false

	static override get styles() {
		return css`
			:host {
				display: grid;
				grid-template-rows: subgrid;
				grid-row: 1 / -1;
				border-inline-end: 1px solid var(--border-color);
			}

			.header-day {
				grid-row: 1;
				border-bottom: 1px solid var(--border-color);
				color: var(--text-muted);
				background-color: var(--bg);
				position: sticky;
				top: 0;
				z-index: 100;
				container-type: inline-size;
			}

			.content {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: 0.625rem 0;
				height: 100%;
				box-sizing: border-box;
			}

			.day-name {
				font-size: 0.85rem;
				text-transform: uppercase;
				letter-spacing: 1px;
				margin-bottom: 0.25rem;
			}

			.day-number {
				font-size: 1.5rem;
				width: 2.5rem;
				height: 2.5rem;
				display: flex;
				align-items: center;
				justify-content: center;

				&[data-today] {
					background-color: var(--accent);
					color: #fff;
					border-radius: 50%;
				}
			}

			.events-container {
				grid-row: 2;
				display: grid;
				grid-template-rows: repeat(1440, var(--minute-height));
				grid-template-columns: 1fr;
				height: 100%;
				position: relative;
				container-type: inline-size;
			}

			mitra-event {
				grid-column: 1 / -1;
			}

			@container (max-width: 150px) {
				.content {
					flex-direction: row;
					gap: 0.375rem;
					padding: 0.25rem;
					justify-content: flex-start;
				}
				.day-name { font-size: 0.75rem; margin-bottom: 0; }
				.day-number {
					font-size: 0.9rem; width: auto; height: auto; border-radius: 0;

					&[data-today] {
						background: none;
						color: var(--accent);
						font-weight: bold;
					}
				}

				.events-container {
					display: flex;
					flex-direction: column;
					gap: 0.25rem;
					padding: 0.25rem;
					overflow-y: auto;
				}

				mitra-event {
					min-height: 1.5rem;
					/* Cleanly disable JS clustering logic in narrow list mode! */
					--overlap-slot: 0 !important;
					--overlap-total: 1 !important;
					--overlap-span: 1 !important;
				}
			}
		`
	}

	protected override get template() {
		return html`
			<div class="header-day">
				<div class="content">
					<div class="day-name">${this.date.format({ weekday: 'short' })}</div>
					<div class="day-number" ?data-today=${this.today}>${this.date.format({ day: 'numeric' })}</div>
				</div>
			</div>

			<div class="events-container">
				${CalendarEvent.cluster(this.events).map(e => html`<mitra-event .event=${e}></mitra-event>`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-day': Day
	}
}