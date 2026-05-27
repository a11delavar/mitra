import { Component, component, html, css, property, event } from '@a11d/lit'
import { Task } from '@lit/task'
import { fetchIntegrations, toggleSourceVisibility } from './Api.js'
import type { Source } from 'shared'

@component('mitra-sidebar')
export class Sidebar extends Component {
	@event() openChange!: EventDispatcher<boolean>
	@property({ type: Boolean, reflect: true }) open = false

	private readonly fetchTask = new Task(this, fetchIntegrations, () => [])

	static override get styles() {
		return css`
			mitra-sidebar {
				display: flex;
				flex-direction: column;
				transition: margin-inline-start 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
				z-index: 1000;

				@media (max-width: 800px) {
					position: absolute;
					inset: 0;
					width: auto;
					margin-inline-start: 0;
					pointer-events: none;
					opacity: 1;
				}

				&:not([open]) {
					margin-inline-start: -280px;
					opacity: 0;
					pointer-events: none;
					@media (max-width: 800px) {
						margin-inline-start: 0;
						opacity: 1;
					}
				}

				&[open] {
					@media (max-width: 800px) {
						pointer-events: auto;
					}
				}

				.backdrop {
					display: none;

					@media (max-width: 800px) {
						display: block;
						position: absolute;
						inset: 0;
						background-color: rgba(0, 0, 0, 0.4);
						opacity: 0;
						transition: opacity 0.3s ease;

						&[data-open] {
							opacity: 1;
						}
					}
				}

				nav {
					display: flex;
					flex-direction: column;
					width: 280px;
					height: 100%;
					border-inline-end: 1px solid var(--color-surface);
					padding: 2rem 1.5rem;
					gap: 2rem;
					overflow-y: auto;
					box-sizing: border-box;
					font-family: 'Inter', sans-serif;
					background-color: transparent;

					@media (max-width: 800px) {
						position: relative;
						height: 100%;
						background-color: var(--color-background);
						box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
						transform: translateX(-100%);
						transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

						&[data-open] {
							transform: translateX(0);
						}
					}
				}

				.integration {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;

					header {
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
						margin-bottom: 0.25rem;
						padding-left: 0.5rem;
					}

					.sources {
						display: flex;
						flex-direction: column;
						gap: 2px;

						.source {
							display: flex;
							align-items: center;
							gap: 0.625rem;
							padding: 0.4rem 0.5rem;
							border-radius: 0.375rem;
							color: var(--color-text);
							font-size: 0.8125rem;
							font-weight: 400;
							cursor: pointer;
							transition: background-color 0.15s ease, color 0.15s ease;

							&:hover {
								background-color: color-mix(in srgb, var(--color-text) 8%, transparent);

								.more-icon {
									opacity: 1;
								}
							}

							.color {
								width: 10px;
								height: 10px;
								border-radius: 3px;
								flex-shrink: 0;
							}

							.name {
								flex: 1;
								white-space: nowrap;
								overflow: hidden;
								text-overflow: ellipsis;
							}

							.actions {
								display: flex;
								align-items: center;
								gap: 0.25rem;

								.eye-icon {
									opacity: 1;
									color: var(--color-text-muted);
									font-size: 16px;
									transition: opacity 0.15s ease, color 0.15s ease;

									&:hover {
										color: var(--color-text);
									}

									&.hidden {
										opacity: 0.5;
									}
								}

								.more-icon {
									opacity: 0;
									color: var(--color-text-muted);
									font-size: 16px;
									transition: opacity 0.15s ease, color 0.15s ease;

									&:hover {
										color: var(--color-text);
									}
								}
							}
						}
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	private async toggleVisibility(source: Source) {
		await toggleSourceVisibility(source.id, !source.hidden)
		source.hidden = !source.hidden
		this.fetchTask.run()
	}

	protected override get template() {
		return html`
			<div class="backdrop" ?data-open=${this.open} @click=${() => this.openChange.dispatch(false)}></div>
			<nav ?data-open=${this.open}>
				${this.fetchTask.value?.map(integration => html`
					<div class="integration">
						<header>
							${integration.config?.username || integration.type}
						</header>
						<div class="sources">
							${integration.sources.map(source => html`
								<div class="source">
									<div class="color" style="background-color: ${source.color || 'var(--color-text-muted)'}"></div>
									<div class="name">
										${source.name}
									</div>
									${this.getActionsTemplate(source)}
								</div>
							`)}
						</div>
					</div>
				`)}
			</nav>
		`
	}

	private getActionsTemplate(source: Source) {
		return html`
			<div class="actions">
				<mitra-icon class="more-icon" icon="more-horizontal"></mitra-icon>
				<mitra-icon
					class="eye-icon ${source.hidden ? 'hidden' : ''}"
					icon=${source.hidden ? 'eye-off' : 'eye'}
					title=${source.hidden ? 'Show source' : 'Hide source'}
					@click=${() => this.toggleVisibility(source)}
				></mitra-icon>
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-sidebar': Sidebar
	}
}
