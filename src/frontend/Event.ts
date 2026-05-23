import { component, html, property, Component, css } from '@a11d/lit'
import { CalendarEvent } from 'shared'

@component('mitra-event')
export class Event extends Component {
	@property({
		type: Object,
		updated(this: Event) {
			this.style.setProperty('--mitra-event-color', this.event?.color || '');
			this.style.setProperty('--mitra-event-grid-row', `${this.event?.startMinute} / ${this.event?.endMinute}`);
			this.style.setProperty('--overlap-slot', `${this.event?.slot}`);
			this.style.setProperty('--overlap-total', `${this.event?.total}`);
			this.style.setProperty('--overlap-span', `${this.event?.span}`);
			this.toggleAttribute('continued-from-previous', !!this.event?.continuedFromPrevious);
			this.toggleAttribute('continues-next', !!this.event?.continuesNext);
			this.toggleAttribute('timed', !!this.event?.isTimed);
		}
	}) event?: CalendarEvent

	static override get styles() {
		return css`
			:host {
				display: block;
				background-color: color-mix(in srgb, var(--mitra-event-color) 25%, var(--bg));
				border-inline-start: 3px solid var(--mitra-event-color);
				border-radius: 0.25rem;
				color: var(--mitra-event-color);
				font-size: 0.75rem;
				margin-top: 1px;
				min-height: 0;
				grid-row: var(--mitra-event-grid-row);

				/* Collision Overlap Logic */
				--overlap-s: var(--overlap-slot, 0);
				--overlap-t: var(--overlap-total, 1);
				--overlap-sp: var(--overlap-span, 1);

				margin-inline-start: calc((var(--overlap-s) / var(--overlap-t)) * 100%);
				width: min(calc((var(--overlap-sp) / var(--overlap-t)) * 100% + 0.25rem), 100%);
				z-index: calc(var(--overlap-s) + 1);
				outline: 1px solid var(--bg);
				outline-offset: -1px;
				box-sizing: border-box;
				container-type: size;
				overflow: hidden;

				&[continues-next] {
					border-end-start-radius: 0;
					border-end-end-radius: 0;
					border-bottom: 2px dashed color-mix(in srgb, var(--mitra-event-color) 50%, transparent);

					.layout-wrapper { padding-bottom: 0; }

					@container (max-height: 45px) {
						border-start-end-radius: 0;
						border-end-end-radius: 0;
						border-bottom: none;
						margin-inline-end: -0.25rem;
						.layout-wrapper { padding-inline-end: 0.5rem; }
					}
				}

				&[continued-from-previous] {
					border-start-start-radius: 0;
					border-start-end-radius: 0;
					border-top: 2px dashed color-mix(in srgb, var(--mitra-event-color) 50%, transparent);

					.layout-wrapper { padding-top: 0; }

					@container (max-height: 45px) {
						border-start-start-radius: 0;
						border-end-start-radius: 0;
						border-top: none;
						border-inline-start: none;
						margin-inline-start: -0.25rem;
						.layout-wrapper { padding-inline-start: 0.5rem; }
					}
				}
			}

			.layout-wrapper {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding: 0.25rem 0.375rem 0;
				height: 100%;
				box-sizing: border-box;

				@container (max-height: 45px) {
					flex-direction: var(--event-small-flex-direction, column);
					align-items: var(--event-small-align-items, flex-start);
					gap: var(--event-small-gap, 0.125rem);
					padding: var(--event-small-padding, 0.25rem 0.375rem 0);
				}
			}

			.heading {
				font-weight: 600;
				white-space: normal;
				word-break: break-word;
				line-height: 1.1;
				color: color-mix(in srgb, var(--mitra-event-color) 50%, var(--text-light));

				@container (max-height: 45px) {
					flex: var(--event-small-heading-flex, initial);
					white-space: var(--event-small-heading-nowrap, normal);
					overflow: var(--event-small-heading-overflow, visible);
					text-overflow: var(--event-small-heading-text-overflow, clip);
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
					display: var(--event-small-time-display, none);
					flex-shrink: 0;
				}
			}

			.end-time {
				@container (max-height: 45px) {
					display: none;
				}
			}

			:host(:not([timed])) .time {
				display: none;
			}
		`
	}

	protected override get template() {
		return !this.event ? html.nothing : html`
			<div class="layout-wrapper">
				<div class="time">
					${this.event.range?.start?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}<span class="end-time"> - ${this.event.range?.end?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
				</div>
				<div class="heading">${this.event.heading}</div>
				<slot></slot>
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-event': Event
	}
}