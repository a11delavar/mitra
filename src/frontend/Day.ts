import { Component, component, html, property, css, event } from '@a11d/lit'
import { DateTime } from '@3mo/date-time'
import { EntrySegment } from 'shared'
import './EventSegment.js'

@component('mitra-day')
export class Day extends Component {
	@event({ bubbles: true, composed: true }) navigate!: EventDispatcher<DateTime>
	@event({ bubbles: true, composed: true }) switchToWeek!: EventDispatcher

	@property({ type: Object }) date!: DateTime
	@property({ type: Array }) entries = new Array<EntrySegment>()
	@property({ type: Number }) hiddenEventsCount = 0
	@property({ type: Boolean, reflect: true }) today = false

	static override get styles() {
		return css`
			mitra-day {
				display: grid;
				grid-template-rows: min-content 1fr;
				position: relative;
				transition: background 0.15s ease;

				&[data-with-background] {
					background: var(--color-surface);
				}

				&:not([data-with-background]) {
					.header .day, .header .month {
						color: var(--color-text-muted);
					}
				}

				.header {
					grid-row: 1;
					color: var(--color-text-muted);
					position: sticky;
					top: 0;
					z-index: 100;
					display: flex;
					flex-direction: row;
					align-items: center;
					justify-content: center;
					padding: 0.5rem 0.25rem;
					gap: 0.375rem;
					box-sizing: border-box;
					margin-inline: -1px;

					@container (max-height: 450px) {
						position: absolute;
						top: 0.25rem;
						inset-inline-end: 0.25rem;
						padding: 0.125rem 0.25rem;
						border-radius: 0.25rem;
						border: none;
						z-index: 10;
					}

					.weekday {
						font-size: 0.7rem;
						font-weight: 600;

						@container (max-height: 450px) {
							display: none;
						}

						&[data-today] {
							color: var(--color-accent);
						}
					}

					.day {
						font-size: 0.875rem;
						font-weight: 500;
						display: flex;
						align-items: center;
						justify-content: center;
						line-height: 1;

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
							border-radius: 1rem;
							min-width: 1.35rem;
							height: 1.35rem;
							padding: 0 0.35rem;
							font-weight: 700;
							box-sizing: border-box;
							view-transition-name: today-badge;

							@container (max-height: 450px) {
								font-weight: 600;
								min-width: 1.5rem;
								min-height: 1.5rem;
								width: auto;
								height: auto;
								padding: 0.2rem 0.4rem;
							}
						}
					}

					.month {
						color: var(--color-text);
						font-weight: 700;
						font-size: 0.875rem;
					}
				}

				.entries {
					grid-row: 2;
					display: grid;
					grid-template-rows: repeat(1440, var(--minute-height));
					grid-template-columns: 1fr;
					position: relative;
					container-type: inline-size;
					padding-inline: 1px;

					@container (max-height: 450px) {
						grid-template-rows: 1.75rem repeat(var(--max-slots), 1.375rem);
						grid-auto-rows: 1.375rem;
						row-gap: 0.125rem;
						margin-top: 0;
						box-sizing: border-box;
						overflow: hidden;
					}

					mitra-event-segment {
						grid-column: 1 / -1;
						z-index: 2;
						position: relative;

						@container (max-height: 450px) {
							grid-row: var(--month-slot, auto) !important;
							--overlap-slot: 0 !important;
							--overlap-total: 1 !important;
							--overlap-span: 1 !important;
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
							grid-row: calc(var(--max-slots) + 1);
							grid-column: 1 / -1;
						}

						&:hover {
							background-color: color-mix(in srgb, var(--color-text-muted) 15%, transparent);
							color: var(--color-text);
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		return html`
			<div class="header">
				${this.date.formatToParts({ weekday: 'long', month: this.date.day === 1 ? 'short' : undefined, day: 'numeric' }).filter(part => part.type !== 'literal').map(part => html`
					<span class="${part.type}" ?data-today=${this.today}>${part.value}</span>
				`)}
			</div>

			<div class="entries">
				${this.entries.map(s => html`<mitra-event-segment .segment=${s}></mitra-event-segment>`)}
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