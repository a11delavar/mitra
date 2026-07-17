import { Component, component, html, property, css, repeat, styleMap } from '@a11d/lit'
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

					/* The year strip collapses this cell to a bare centred numeral — driven by the parent
					   (mitra-months), NOT a container query: a year cell can't be told apart from a narrow
					   (mobile) month cell by its own size alone. See Months.ts. */

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
					/* fr, not a repeated length — see the .axis rule in Days.ts for why. */
					grid-template-rows: repeat(1440, minmax(0, 1fr));
					grid-template-columns: 1fr;
					position: relative;
					container-type: inline-size;
					padding-inline: 1px;

					mitra-entry-segment {
						grid-column: 1 / -1;
						z-index: 2;
						position: relative;

						/* Chips share this one z-plane on purpose: paint order is DOM order, which timedOn
						   keeps sorted by start — so a chip always covers what began BEFORE it (a cascading
						   chip covers its base; a fresh block covers the poking tail of a long earlier chip),
						   never the other way around. Elevating cascades by inset instead would let a long
						   tail bury a later short block wholesale. */

						/* A partially covered chip surfaces while selected (its editor is open; set on click,
						   see EventSegment). Lives here, not in EventSegment.ts: the flat z-index above
						   outweighs any selector written there ((0,1,2) vs (0,1,1)), so its exception must too. */
						&[selected] {
							z-index: 99;
						}

						/* The same specificity trap would pin an actively dragged chip (or a move's ghost) at
						   the flat level, beneath later-starting chips — restate its elevation where it wins. */
						&[dragging] {
							z-index: 9999;
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
				${/* Keyed on the entry INSTANCE — the store keeps it stable while ids change under it
				    (draft graduation, cross-source migration), so the element (and an open editor
				    popover inside it) survives those. */ ''}
				${repeat(this.entries, segment => segment.entry, segment => html`
					<mitra-entry-segment
						style=${styleMap({
							gridRow: `${segment.startMinute} / ${segment.endMinute}`,
							'--overlap-slot': `${segment.overlap?.slot ?? 0}`,
							'--overlap-total': `${segment.overlap?.total ?? 1}`,
							'--overlap-span': `${segment.overlap?.span ?? 1}`,
							'--overlap-inset': `${segment.overlap?.inset ?? 0}`,
						})}
						?data-overlay=${(segment.overlap?.inset ?? 0) > 0}
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
