import { component, html, property, Component, css } from '@a11d/lit'
import { EventSegment } from 'shared'

@component('mitra-event')
export class Event extends Component {
	@property({
		type: Object,
		updated(this: Event) {
			this.style.setProperty('--mitra-event-color', this.segment?.event.color || '');
			this.style.setProperty('--mitra-event-grid-row', `${this.segment?.startMinute} / ${this.segment?.endMinute}`);
			this.style.setProperty('--overlap-slot', `${this.segment?.slot}`);
			this.style.setProperty('--overlap-total', `${this.segment?.total}`);
			this.style.setProperty('--overlap-span', `${this.segment?.span}`);
			this.style.setProperty('--month-slot', this.segment?.monthSlot !== undefined ? `${this.segment.monthSlot + 1}` : 'auto');
			this.toggleAttribute('continued-from-previous', !!this.segment?.continuedFromPrevious);
			this.toggleAttribute('continues-next', !!this.segment?.continuesNext);
			if (this.segment?.segmentDate) {
				this.style.viewTransitionName = `event-${this.segment.event.id}-${this.segment.segmentDate.toISOString().split('T')[0]}`
			}
		}
	}) segment?: EventSegment

	static override get styles() {
		return css`
			mitra-event {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding: 0.25rem 0.375rem 0;
				background-color: color-mix(in srgb, var(--mitra-event-color) 25%, var(--color-background));
				border-inline-start: 3px solid var(--mitra-event-color);
				border-radius: 0.25rem;
				color: color-mix(in srgb, var(--mitra-event-color) 60%, var(--color-text));
				font-size: 0.75rem;
				margin-top: 1px;
				min-height: 0;
				grid-row: var(--mitra-event-grid-row);

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

				@container (max-height: 45px) {
					flex-direction: column;
					align-items: flex-start;
					gap: 0.125rem;
					padding: 0.25rem 0.375rem 0;
				}

				&[continues-next] {
					border-end-start-radius: 0;
					border-end-end-radius: 0;
					border-bottom: 2px dashed color-mix(in srgb, var(--mitra-event-color) 50%, transparent);
					padding-bottom: 0;

					@container (max-height: 45px) {
						border-start-end-radius: 0;
						border-end-end-radius: 0;
						border-bottom: none;
						margin-inline-end: -0.25rem;
						padding-inline-end: 0.5rem;
					}
				}

				&[continued-from-previous] {
					border-start-start-radius: 0;
					border-start-end-radius: 0;
					border-top: 2px dashed color-mix(in srgb, var(--mitra-event-color) 50%, transparent);
					padding-top: 0;

					@container (max-height: 45px) {
						border-start-start-radius: 0;
						border-end-start-radius: 0;
						border-top: none;
						border-inline-start: none;
						margin-inline-start: -0.25rem;
						padding-inline-start: 0.5rem;
					}
				}

				.heading {
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

				.time {
					opacity: 0.75;
					font-size: 0.7rem;
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;

					@container (max-height: 45px) {
						display: none;
						flex-shrink: 0;
					}

					.separator, .end {
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
					<span class="start">${this.segment.event.start?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
					<span class="separator">-</span>
					<span class="end">${this.segment.event.end?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
				</div>
			`}
			<div class="heading">${this.segment.event.heading}</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-event': Event
	}
}