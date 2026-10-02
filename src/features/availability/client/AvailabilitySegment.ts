import { Component, component, css, html, property, state, bind } from '@a11d/lit'
import { type EntrySegment } from '../../entries/client/EntrySegment.js'
import { EntryEditorAnchor } from '../../entries/client/EntryEditorAnchor.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { entryColors } from '../../entries/client/entryColors.css.js'
import { Availability } from './Availability.js'
import { getSource } from '../../../infrastructure/http/Api.js'

/**
 * One day's slice of an availability entry: a tinted window, with its label along the day's end edge if it says something. The editor sits in the window, which is what it anchors at: the element itself has no box.
 *
 * It has no click handler of its own: the grid captures the pointer for its create gesture, so
 * `EntryDragController` turns a tap into {@link open}, just as it does for chips. A drag across it still creates an entry.
 */
@component('mitra-availability-segment')
export class AvailabilitySegment extends Component {
	@property({ type: Object }) segment?: EntrySegment

	readonly store = new EntryStore(this)
	readonly editor = new EntryEditorAnchor(this)

	@state() open = false

	protected override updated(changed: Map<PropertyKey, unknown>) {
		super.updated?.(changed)
		const entry = this.segment?.entry
		if (entry) {
			this.style.setProperty('--mitra-entry-segment-color', entry.color ?? getSource(entry.sourceId)?.color ?? '')
			this.toggleAttribute('data-unlabelled', !Availability.labelOf(entry))
		}
	}

	static override get styles() {
		return css`
			/* Every window is one thing, a tint, and a label is only text along its edge. Layered by z-index rather than order,
			   since overlapping windows interleave in the DOM: the windows, the tap target and the editor's anchor, under the hour
			   lines and composing into a darker mix where they overlap; the labels above every window (3). */
			mitra-availability-segment {
				display: contents;
				/* The same colors a chip declares, so the editor opened from here looks the same. */
				${entryColors};

				> .window, > .labels {
					grid-column: 1 / -1;
					grid-row: var(--_availability-rows);
					position: relative;
				}

				/* The same tint reads far weaker on a light day than on a dark one, so light mode takes more of it. */
				> .window {
					background-color: light-dark(
						color-mix(in srgb, var(--mitra-entry-segment-color) 14%, transparent),
						color-mix(in srgb, var(--mitra-entry-segment-color) 8%, transparent)
					);
				}

				> .labels {
					z-index: 3;
					pointer-events: none;
					overflow: clip;
					container-type: size;
					display: flex;
					justify-content: flex-end;
					align-items: flex-start;

					> .label {
						/* Physical on purpose: in the label's vertical writing mode, block and inline sides turn. Placed at its
						   fraction of the window, from its start (0) to its end (1). */
						position: relative;
						top: calc(0.25rem + var(--_availability-label-at) * (100% - 0.5rem));
						translate: 0 calc(var(--_availability-label-at) * -100%);
						max-height: calc(100% - 0.5rem);
						writing-mode: vertical-rl;
						line-height: var(--_availability-label);
						font-size: 0.6rem;
						font-weight: 700;
						letter-spacing: 0.02em;
						color: color-mix(in srgb, var(--mitra-entry-segment-color) 55%, var(--color-text));
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;

						@container (max-height: 1.5rem) {
							display: none;
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const entry = this.segment?.entry
		return !entry ? html.nothing : html`
			<div class="window">
				${!this.open ? html.nothing : html`
					<mitra-entry-details ?open=${bind(this, 'open')}
						.segment=${this.segment}
						@click=${(e: Event) => e.stopPropagation()}
					></mitra-entry-details>
				`}
			</div>
			<div class="labels">
				${!Availability.labelOf(entry) || this.segment!.hasPrevious ? html.nothing : html`<span class="label">${Availability.labelOf(entry)}</span>`}
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-availability-segment': AvailabilitySegment
	}
}
