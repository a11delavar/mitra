import { Component, component, html, css, property, event } from '@a11d/lit'
import { getIntegrations, toggleSourceVisibility, deleteIntegration, fetchIntegrations } from './Api.js'
import { DialogIntegration } from './DialogIntegration.js'
import { SourceType, type Source } from 'shared'

@component('mitra-sidebar')
export class Sidebar extends Component {
	@event() openChange!: EventDispatcher<boolean>
	@property({ type: Boolean, reflect: true }) open = false

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
					padding: 1.5rem 1rem;
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

				.add-integration {
					all: unset;
					margin-top: auto;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 0.5rem;
					padding: 0.5rem 0.75rem;
					border: 1px dashed color-mix(in srgb, var(--color-text) 15%, transparent);
					border-radius: var(--border-radius);
					color: var(--color-text-muted);
					font-size: 0.8125rem;
					font-weight: 500;
					cursor: pointer;
					transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;

					mitra-icon { font-size: 16px; }

					&:hover {
						color: var(--color-text);
						background: color-mix(in srgb, var(--color-text) 6%, transparent);
						border-color: color-mix(in srgb, var(--color-text) 25%, transparent);
					}
				}

				.integration {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;

					header {
						display: flex;
						align-items: center;
						gap: 0.25rem;
						font-size: 0.75rem;
						font-weight: 600;
						color: var(--color-text-muted);
						margin-bottom: 0.25rem;
						padding-inline-start: 0.5rem;
						padding-inline-end: 0.3rem;

						.title {
							flex: 1;
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;
						}

						.more {
							all: unset;
							display: flex;
							align-items: center;
							justify-content: center;
							padding: 0.2rem;
							border-radius: var(--border-radius);
							color: var(--color-text-muted);
							font-size: 16px;
							cursor: pointer;
							opacity: 0;
							transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;

							&:hover {
								color: var(--color-text);
								background: color-mix(in srgb, var(--color-text) 8%, transparent);
							}
						}
					}

					&:hover .more, &:has(menu:popover-open) .more {
						opacity: 1;
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
							border-radius: var(--border-radius);
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
								border-radius: var(--border-radius);
								flex-shrink: 0;
							}

							.type-icon {
								font-size: 14px;
								color: var(--color-text-muted);
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
		this.requestUpdate()
	}

	private closeMenu(e: Event) {
		(e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover()
	}

	private async openDialog(id: string) {
		await new DialogIntegration({ id }).confirm()
		this.requestUpdate()
	}

	private async removeIntegration(id: string) {
		await deleteIntegration(id)
		await fetchIntegrations()
		this.requestUpdate()
	}

	protected override get template() {
		return html`
			<div class="backdrop" ?data-open=${this.open} @click=${() => this.openChange.dispatch(false)}></div>
			<nav ?data-open=${this.open}>
				${getIntegrations().map(i => html`
					<div class="integration">
						<header>
							<span class="title">${i.credentials?.username || i.type}</span>
							<button class="more" popovertarget="menu-${i.id}" style="anchor-name: --anchor-${i.id}">
								<mitra-icon icon="more-horizontal"></mitra-icon>
							</button>
							<menu popover id="menu-${i.id}" style="position-anchor: --anchor-${i.id}">
								<button @click=${(e: Event) => { this.closeMenu(e); this.openDialog(i.id) }}>
									<mitra-icon icon="pencil"></mitra-icon> Edit
								</button>
								<button class="danger" @click=${(e: Event) => { this.closeMenu(e); this.removeIntegration(i.id) }}>
									<mitra-icon icon="trash-2"></mitra-icon> Delete
								</button>
							</menu>
						</header>
						<div class="sources">
							${i.sources.filter(source => source.enabled).map(source => html`
								<div class="source">
									<div class="color" style="background-color: ${source.color || 'var(--color-text-muted)'}"></div>
									<mitra-icon
										class="type-icon"
										icon=${source.type === SourceType.Task ? 'list-todo' : 'calendar'}
										title=${source.type === SourceType.Task ? 'Tasks' : 'Events'}
									></mitra-icon>
									<div class="name">
										${source.name}
									</div>
									${this.getActionsTemplate(source)}
								</div>
							`)}
						</div>
					</div>
				`)}
				<button class="add-integration" @click=${() => this.openDialog('')}>
					<mitra-icon icon="plus"></mitra-icon> Add Integration
				</button>
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
