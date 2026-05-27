import { component, html, property, Component, css } from '@a11d/lit'
import { EntrySegment } from 'shared'

@component('mitra-event-details')
export class EventDetails extends Component {
	@property({ type: Object }) segment?: EntrySegment

	protected override createRenderRoot() { return this }

	static override get styles() {
		return css`
			mitra-event-details {
				display: contents;

				[popover] {
					&:popover-open {
						display: flex;
						flex-direction: column;
					}

					border: none;
					margin: 0;
					outline: none;
					padding: 0;
					overflow: hidden;

					position: fixed;
					margin-inline: 0.25rem;
					position-area: right center;
					position-visibility: always;
					position-try: normal flip-inline, flip-block, flip-block flip-inline;

					width: 300px;
					max-height: 80dvh;
					overflow-y: auto;

					background: color-mix(in srgb, color-mix(in srgb, var(--mitra-event-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
					backdrop-filter: blur(10px);
					border: var(--border);
					border-radius: 0.5rem;
					box-shadow:
						0 0 0 1px rgba(80, 140, 255, 0.06),
						0 8px 32px rgba(0, 0, 0, 0.5),
						0 24px 64px rgba(0, 0, 0, 0.35),
						inset 0 1px 0 rgba(255, 255, 255, 0.05);
					color: var(--color-text);
					font-family: 'Inter', sans-serif;
					font-size: 0.75rem;

					&::backdrop {
						background: transparent;
					}

					@media (max-width: 600px) {
						inset-area: none;
						position-area: none;

						inset-block-start: auto;
						inset-block-end: 0;
						inset-inline: 0;
						width: 100%;
						max-width: none;
						max-height: 90dvh;
						margin: 0;
						border-radius: 20px 20px 0 0;
						border: none;
						border-block-start: var(--border);

						transition: transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.3s ease;

						@starting-style {
							transform: translateY(100%);
							opacity: 0;
						}
					}

					& > .header {
						display: flex;
						align-items: flex-start;
						gap: 1rem;
						padding: 0.875rem 0.875rem 0.5rem;

						.title {
							flex: 1;
							font-size: 0.9375rem;
							font-weight: 600;
							color: var(--color-text);
							line-height: 1.3;
							white-space: normal;
							word-break: break-word;
							margin: 0;
						}

						.close {
							display: flex;
							align-items: center;
							justify-content: center;
							background: none;
							border: none;
							padding: 0.25rem;
							cursor: pointer;
							color: var(--color-text-muted);
							border-radius: var(--border-radius);
							font-size: 14px;
							flex-shrink: 0;

							&:hover {
								color: var(--color-text);
								background: rgba(255, 255, 255, 0.08);
							}
						}
					}

					& > ul {
						list-style: none;
						margin: 0;
						padding: 0.5rem 1rem 1rem;
						display: grid;
						grid-template-columns: auto minmax(0, 1fr);
						gap: 1rem;

						li {
							display: grid;
							grid-template-columns: subgrid;
							grid-column: -1 / 1;
							align-items: center;
							gap: 0.625rem;

							mitra-icon {
								font-size: 0.87rem;
								color: var(--color-text-muted);
								flex-shrink: 0;
							}

							.content {
								display: flex;
								align-items: center;
								flex-wrap: wrap;
								opacity: 0.85;
							}

							&.description {
								align-items: start;
								border-block-start: 1px solid rgba(255, 255, 255, 0.06);
								padding-block-start: 0.6875rem;
								margin-block-start: 0.375rem;

								.content {
									white-space: pre-wrap;
									word-break: break-word;
									min-width: 0;
									line-height: 1.4;
								}
							}

							&.source {
								.dot {
									width: 11px;
									height: 11px;
									border-radius: var(--border-radius);
									flex-shrink: 0;
									margin-inline-start: 2px;
								}
							}
						}

						.arrow {
							margin-inline: 0.125rem;
						}

						.duration {
							color: var(--color-text-muted);
							margin-inline-start: 0.375rem;
						}

						.tag {
							display: inline-flex;
							align-items: center;
							background: rgba(59, 130, 246, 0.12);
							border-radius: var(--border-radius);
							padding: 0.05rem 0.375rem;
							margin-inline-start: 0.375rem;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		if (!this.segment) {
			return html.nothing
		}

		return html`
			<article popover style="position-anchor: ${`--mitra-event-segment-${this.segment.entry.id}`}" @click=${(e: Event) => e.stopPropagation()}>
				<header class="header">
					<h2 class="title">${this.segment.entry.heading}</h2>
					<button class="close" @click=${(e: Event) => { e.stopPropagation(); this.querySelector<HTMLElement>('[popover]')?.hidePopover() }}>
						<mitra-icon icon="x"></mitra-icon>
					</button>
				</header>
				<ul>
					${!this.segment.isTimed ? html.nothing : html`
						<li class="time">
							<mitra-icon icon="clock"></mitra-icon>
							<div class="content">
								${this.segment.entry.start?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}
								<span class="arrow">→</span>
								${this.segment.entry.end?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}
								<span class="duration">${this.segment.entry.duration}</span>
							</div>
						</li>
					`}
					${!this.segment.entry.start ? html.nothing : html`
						<li class="date">
							<mitra-icon icon="calendar-days"></mitra-icon>
							<div class="content">
								${this.segment.entry.start.format({ weekday: 'long', month: 'long', day: 'numeric' })}
								${this.segment.entry.allDay ? html`<span class="tag">All day</span>` : html.nothing}
							</div>
						</li>
					`}
					${!this.segment.entry.source?.name ? html.nothing : html`
						<li class="source">
							<span class="dot" style="background: ${this.segment.entry.source.color}"></span>
							<div class="content">${this.segment.entry.source.name}</div>
						</li>
					`}
					${!this.segment.entry.description ? html.nothing : html`
						<li class="description">
							<mitra-icon icon="align-left"></mitra-icon>
							<div class="content">${this.segment.entry.description}</div>
						</li>
					`}
				</ul>
			</article>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-event-details': EventDetails
	}
}
