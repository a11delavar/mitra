import { Component, component, html, property, css } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import type { EntrySegment } from './EntrySegment.js'
import './EventSegment.js'

@component('mitra-day')
export class Day extends Component {
	@property({ type: Object }) date!: DateTime
	@property({ type: Array }) entries: ReadonlyArray<EntrySegment> = []
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
					& > .header .day, & > .header .month {
						color: var(--color-text-muted);
					}
				}

				& > .header {
					grid-row: 1;
					color: var(--color-text-muted);
					position: sticky;
					top: 0;
					z-index: 100;
					display: flex;
					flex-direction: row;
					align-items: baseline;
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
						border-radius: var(--border-radius);
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
							font-weight: 700;
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
							color: var(--color-text);
							border-radius: var(--border-radius);
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

						&[data-today] {
							color: var(--color-accent);
							font-weight: 700;
						}
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

					mitra-entry-segment {
						grid-column: 1 / -1;
						z-index: 2;
						position: relative;
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
				${this.entries.map(segment => html`
					<mitra-entry-segment
						style="grid-row: ${segment.startMinute} / ${segment.endMinute}; --overlap-slot: ${segment.overlap?.slot ?? 0}; --overlap-total: ${segment.overlap?.total ?? 1}; --overlap-span: ${segment.overlap?.span ?? 1};"
						resize="block"
						?has-previous=${segment.hasPrevious}
						?has-next=${segment.hasNext}
						.segment=${segment}
					></mitra-entry-segment>
				`)}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-day': Day
	}
}
