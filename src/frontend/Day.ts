import { Component, component, html, property, css, event } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { CalendarEvent } from 'shared'
import './Event.js'

@component('mitra-day')
export class Day extends Component {
	@event({ bubbles: true, composed: true }) navigate!: EventDispatcher<DateTime>
	@event({ bubbles: true, composed: true }) switchToWeek!: EventDispatcher

	@property({ type: Object }) date!: DateTime
	@property({ type: Array }) events = new Array<CalendarEvent>()
	@property({ type: Number }) hiddenEventsCount = 0
	@property({ type: Boolean, reflect: true }) today = false

	static override get styles() {
		return css`
			mitra-day {
				display: grid;
				grid-template-rows: min-content 1fr;
				border-inline-end: var(--border);
				position: relative;
				transition: background 0.15s ease;

				&[data-with-background] {
					background: var(--color-background);
				}

				.header {
					grid-row: 1;
					border-bottom: var(--border);
					color: var(--color-text-muted);
					position: sticky;
					top: 0;
					z-index: 100;
					container-type: inline-size;
					display: flex;
					flex-direction: row;
					align-items: center;
					justify-content: center;
					padding: 0.5rem;
					gap: 0.125rem;
					box-sizing: border-box;

					@container (max-height: 450px) {
						position: absolute;
						top: 0.25rem;
						inset-inline-end: 0.65rem;
						padding: 0.125rem 0.25rem;
						border-radius: 0.25rem;
						border: none;
						z-index: 10;
					}
				}

				.name {
					font-size: 0.85rem;
					font-weight: 500;

					@container (max-height: 450px) {
						display: none;
					}
				}

				.number {
					font-size: 1.125rem;
					font-weight: 500;
					display: flex;
					align-items: center;
					justify-content: center;

					@container (max-height: 450px) {
						font-size: 0.875rem;
						width: auto;
						height: auto;
						color: var(--color-text);
						border-radius: 0.25rem;
						padding: 0 0.125rem;
					}

					&[data-today] {
						background-color: var(--color-accent);
						color: var(--color-accent-text);
						border-radius: 50%;
						width: 1.75rem;
						height: 1.75rem;
						box-sizing: border-box;
						view-transition-name: today-badge;

						@container (max-height: 450px) {
							font-weight: 600;
							aspect-ratio: 1;
							min-width: 1.5rem;
							min-height: 1.5rem;
							width: auto;
							height: auto;
							padding: 0.2rem;
						}
					}
				}

				.events {
					grid-row: 2;
					display: grid;
					grid-template-rows: repeat(1440, var(--minute-height));
					grid-template-columns: 1fr;
					height: 100%;
					position: relative;
					container-type: inline-size;

					@container (max-height: 450px) {
						grid-template-rows: repeat(var(--max-slots), 1.375rem);
						grid-auto-rows: 1.375rem;
						row-gap: 0.125rem;
						padding: 1.75rem 0 0 0;
						margin-top: 0;
						box-sizing: border-box;
						overflow: hidden;
					}
				}

				mitra-event {
					grid-column: 1 / -1;

					@container (max-height: 450px) {
						grid-row: var(--month-slot, auto) !important;
						--overlap-slot: 0 !important;
						--overlap-total: 1 !important;
						--overlap-span: 1 !important;

						--event-small-flex-direction: row;
						--event-small-align-items: center;
						--event-small-gap: 0.375rem;
						--event-small-padding: 0.125rem 0.375rem;
						--event-small-time-display: block;
						--event-small-heading-flex: 1;
						--event-small-heading-nowrap: nowrap;
						--event-small-heading-overflow: hidden;
						--event-small-heading-text-overflow: ellipsis;
					}
				}

				.more {
					font-size: 0.75rem;
					font-weight: 500;
					color: var(--color-text-muted);
					cursor: pointer;
					padding: 0.125rem 0.375rem;
					margin: 0.125rem 0.25rem 0;
					border-radius: 0.25rem;
					transition: background-color 0.2s, color 0.2s;

					@container (max-height: 450px) {
						grid-row: var(--max-slots);
					}

					&:hover {
						background-color: color-mix(in srgb, var(--color-text-muted) 15%, transparent);
						color: var(--color-text);
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			<div class="header">
				<div class="name">${this.date.format({ weekday: 'short' })}</div>
				<div class="number" ?data-today=${this.today}>${this.date.format({ day: 'numeric' })}</div>
			</div>

			<div class="events">
				${this.events.map(e => html`<mitra-event .event=${e}></mitra-event>`)}
				${!this.hiddenEventsCount ? html.nothing : html`
					<div class="more" @click=${this.handleMoreButtonClick}>
						${t('+${count:number} more', { count: this.hiddenEventsCount })}
					</div>
				`}
			</div>
		`
	}

	private handleMoreButtonClick = (e: Event) => {
		e.stopPropagation()
		this.navigate.dispatch(this.date)
		this.switchToWeek.dispatch()
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-day': Day
	}
}