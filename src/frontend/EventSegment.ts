import { component, html, property, Component, css, eventListener, state, bind } from '@a11d/lit'
import { EntrySegment } from 'shared'
import { colorContrast } from './components/colorContrast.js'

@component('mitra-event-segment')
export class EventSegmentC extends Component {
	@property({
		type: Object,
		updated(this: EventSegmentC) {
			this.style.setProperty('--mitra-event-segment-color', this.segment?.entry.color || '')
			this.style.setProperty('--mitra-event-segment-grid-row', `${this.segment?.startMinute} / ${this.segment?.endMinute}`)
			this.style.setProperty('--overlap-slot', `${this.segment?.slot}`)
			this.style.setProperty('--overlap-total', `${this.segment?.total}`)
			this.style.setProperty('--overlap-span', `${this.segment?.span}`)
			this.style.setProperty('--month-slot', this.segment?.monthSlot !== undefined ? `${this.segment.monthSlot + 2}` : 'auto')
			this.toggleAttribute('continued-from-previous', !!this.segment?.continuedFromPrevious)
			this.toggleAttribute('continues-next', !!this.segment?.continuesNext)
			if (this.segment?.date) {
				this.style.viewTransitionName = `event-${this.segment.entry.id}-${this.segment.index}`
			}
			if (this.segment?.entry.id) {
				this.style.anchorName = this.segment.cssId
			}
		}
	}) segment?: EntrySegment

	@state() open = false

	@eventListener('click')
	protected async handleClick(e: MouseEvent) {
		e.stopPropagation()
		this.open = true
	}

	static override get styles() {
		return css`
			mitra-event-segment {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding: 0.125rem 0.25rem 0;
				background-color: color-mix(in srgb, var(--mitra-event-segment-color) 25%, var(--color-background));
				border-inline-start: 3px solid var(--mitra-event-segment-color);
				border-radius: var(--border-radius);
				color: color-mix(in srgb, var(--mitra-event-segment-color) 60%, var(--color-text));
				font-size: 0.7rem;
				margin-top: 1px;
				min-height: 0;
				grid-row: var(--mitra-event-segment-grid-row);
				cursor: pointer;

				/* Collision Overlap Logic */
				--overlap-s: var(--overlap-slot, 0);
				--overlap-t: var(--overlap-total, 1);
				--overlap-sp: var(--overlap-span, 1);

				margin-inline-start: calc((var(--overlap-s) / var(--overlap-t)) * 100%);
				width: min(calc((var(--overlap-sp) / var(--overlap-t)) * 100% + 0.25rem), calc(100% - (var(--overlap-s) / var(--overlap-t)) * 100%));
				z-index: calc(var(--overlap-s) + 1);
				box-sizing: border-box;
				container-type: size;
				overflow: hidden;
				transition: background-color 0.15s ease, color 0.15s ease;

				&:has([popover]:popover-open) {
					background-color: var(--mitra-event-segment-color);
					color: ${colorContrast('var(--mitra-event-segment-color)')};
				}

				@container (max-height: 450px) {
					flex-direction: row;
					align-items: center;
					gap: 0.25rem;
					padding: 0 0.375rem;
				}

				&[continues-next] {
					border-end-start-radius: 0;
					border-end-end-radius: 0;
					border-bottom: 2px dashed ${colorContrast('var(--mitra-event-segment-color)')};
					padding-bottom: 0;

					@container (max-height: 450px) {
						border-start-end-radius: 0;
						border-end-end-radius: 0;
						border-bottom: none;
						border-inline-end: 2px dashed ${colorContrast('var(--mitra-event-segment-color)')};
						margin-inline-end: -0.25rem;
						padding-inline-end: 0.5rem;
					}
				}

				&[continued-from-previous] {
					border-start-start-radius: 0;
					border-start-end-radius: 0;
					border-top: 2px dashed ${colorContrast('var(--mitra-event-segment-color)')};
					padding-top: 0;

					@container (max-height: 450px) {
						border-start-start-radius: 0;
						border-end-start-radius: 0;
						border-top: none;
						border-inline-start: 2px dashed ${colorContrast('var(--mitra-event-segment-color)')};
						margin-inline-start: -0.25rem;
						padding-inline-start: 0.5rem;
					}
				}

				& > .heading {
					font-weight: 600;
					white-space: normal;
					word-break: break-word;
					line-height: 1.1;

					@container (max-height: 45px) {
						flex: initial;
						white-space: normal;
						overflow: visible;
						text-overflow: clip;
						min-width: 0;
					}

					@container (max-height: 20px) {
						white-space: nowrap;
					}

					@container (max-height: 12px) {
						display: none;
					}
				}

				& > .time {
					opacity: 0.75;
					font-size: 0.65rem;
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;

					@container (max-height: 45px) {
						display: none;
						flex-shrink: 0;
					}

					& > .separator, & > .end {
						@container (max-height: 45px) {
							display: none;
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		return !this.segment ? html.nothing : html`
			${!this.segment.isTimed ? html.nothing : html`
				<div class="time">
					<span class="start">${this.segment.entry.start?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
					<span class="separator">-</span>
					<span class="end">${this.segment.entry.end?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
				</div>
			`}
			<div class="heading">${this.segment.entry.heading}</div>
			${!this.open ? html.nothing : html`
				<mitra-event-details popover ?open=${bind(this, 'open')}
					style="position-anchor: ${this.segment.cssId}"
					.segment=${this.segment}
					@click=${(e: Event) => e.stopPropagation()}
					@change=${() => this.requestUpdate()}
				></mitra-event-details>
			`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-event-segment': EventSegmentC
	}
}