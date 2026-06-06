import { Component, component, html, css, property, event } from '@a11d/lit'
import { getIntegrations, toggleSourceVisibility, updateSourceColor, deleteIntegration, fetchIntegrations, getDefaultSourceId, setDefaultSource } from './Api.js'
import { DialogIntegration } from './DialogIntegration.js'
import { SourceType, type Source } from 'shared'
import { outlineStyles } from './components/outlineStyles.js'

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

					${outlineStyles};
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
					}

					.sources {
						display: flex;
						flex-direction: column;
						gap: 2px;

						.source {
							display: flex;
							align-items: center;
							gap: 0.5rem;
							padding: 0.125rem 0.5rem;
							border-radius: var(--border-radius);

							&:hover {
								background-color: color-mix(in srgb, var(--color-text) 5%, transparent);
								.actions mitra-icon-button { opacity: 1; }
							}

							/* Keep the actions visible while this row's menu popover is open, so the 3-dot
							   doesn't fade out from under its own menu when the pointer leaves the row. */
							&:has(.source-menu:popover-open) .actions mitra-icon-button {
								opacity: 1;
							}

							&[data-hidden] {
								.marker, .type-icon { opacity: 0.4; }
								.name { color: var(--color-text-muted); }
								/* A hidden source always shows its eye toggle, so it can be brought back. */
								.actions .eye-icon { opacity: 1; }
							}

							/* Leading marker: a filled square in the source's colour, or a star when it's the default
							   (both square/star icons). Clicking it toggles default. */
							.marker {
								all: unset;
								flex-shrink: 0;
								display: inline-flex;
								align-items: center;
								justify-content: center;
								cursor: pointer;
								font-size: 0.85rem;
								border-radius: var(--border-radius);
								transition: transform 0.1s;

								&:hover {
									transform: scale(1.15);
								}

								${outlineStyles};
							}

							.source-menu {
								/* Only lay it out when open: an unconditional display on a popover element beats the
								   UA's hide-when-closed rule (author origin wins) and would show it always. */
								&:popover-open {
									display: flex;
									flex-direction: column;
									gap: 0.5rem;
								}

								.menu-row {
									display: flex;
									align-items: center;
									gap: 0.5rem;

									> mitra-icon {
										font-size: 0.9rem;
										color: var(--color-text-muted);
									}
								}
							}

							[popover] {
								background: color-mix(in srgb, var(--color-surface) 90%, transparent);
								backdrop-filter: blur(10px);
								border: var(--border);
								border-radius: 0.5rem;
								padding: 0.5rem;
								box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
								position-area: inline-end span-all;
								position-try-options: flip-inline;
								margin: 0;
								overflow: visible;
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
								font-size: 0.8125rem;
								color: var(--color-text);
							}

							.actions {
								display: flex;
								align-items: center;
								gap: 0.25rem;

								/* On hover-capable devices, action icons stay out of the way until the row is hovered
								   (revealed by &:hover; the default star and a hidden source's eye are forced visible
								   separately). Touch devices have no hover, so they show them always. */
								mitra-icon-button {
									transition: opacity 0.15s ease;

									@media (hover: hover) {
										opacity: 0;
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

	private async setSourceColor(source: Source, color: string | undefined, popover: HTMLElement) {
		if (color) {
			await updateSourceColor(source.id, color)
			source.color = color
			this.requestUpdate()
		}
		popover.hidePopover()
	}

	private async toggleVisibility(source: Source) {
		await toggleSourceVisibility(source.id, !source.hidden)
		source.hidden = !source.hidden
		this.requestUpdate()
	}

	private isDefault(source: Source) {
		return getDefaultSourceId() === source.id
	}

	private async toggleDefault(source: Source) {
		await setDefaultSource(this.isDefault(source) ? undefined : source.id)
		this.requestUpdate()
	}

	private closeMenu(e: Event) {
		(e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover()
	}

	private toggleMenu(e: Event) {
		(e.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>('menu[popover]')?.togglePopover()
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
							<mitra-icon-button icon="more-horizontal" label="Integration options" style="anchor-name: --anchor-${i.id}" @click=${this.toggleMenu}></mitra-icon-button>
							<menu popover id="menu-${i.id}" style="position-anchor: --anchor-${i.id}">
								<button @click=${(e: Event) => { this.closeMenu(e); this.openDialog(i.id) }}>
									<mitra-icon icon="pencil"></mitra-icon>
									Edit
								</button>
								<button class="danger" @click=${(e: Event) => { this.closeMenu(e); this.removeIntegration(i.id) }}>
									<mitra-icon icon="trash-2"></mitra-icon>
									Delete
								</button>
							</menu>
						</header>
						<div class="sources">
							${i.sources.filter(source => source.enabled).map(source => html`
								<div class="source" ?data-hidden=${source.hidden}>
									<button class="marker" @click=${() => this.toggleDefault(source)}
										title=${this.isDefault(source) ? 'Default for new entries — click to unset' : 'Set as the default for new entries'}>
										<mitra-icon icon=${this.isDefault(source) ? 'star' : 'square'} fill style="color: ${source.color || 'var(--color-text-muted)'}"></mitra-icon>
									</button>
									<mitra-icon
										class="type-icon"
										icon=${source.type === SourceType.Task ? 'list-todo' : 'calendar'}
										title=${source.type === SourceType.Task ? 'Tasks' : 'Events'}
									></mitra-icon>
									<div class="name">${source.name}</div>
									${this.getActionsTemplate(source)}
								</div>
							`)}
						</div>
					</div>
				`)}
				<button class="add-integration" @click=${() => this.openDialog('')}>
					<mitra-icon icon="plus"></mitra-icon>
					Add Integration
				</button>
			</nav>
		`
	}

	private getActionsTemplate(source: Source) {
		return html`
			<div class="actions">
				<mitra-icon-button
					class="eye-icon"
					icon=${source.hidden ? 'eye-off' : 'eye'}
					label=${source.hidden ? 'Show calendar' : 'Hide calendar'}
					@click=${() => this.toggleVisibility(source)}
				></mitra-icon-button>
				<mitra-icon-button
					class="menu-icon"
					icon="more-horizontal"
					label="Calendar options"
					style="anchor-name: --source-menu-${source.id}"
					@click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement)?.togglePopover()}
				></mitra-icon-button>
				<div popover id="source-menu-${source.id}" class="source-menu" style="position-anchor: --source-menu-${source.id}; margin-inline: 0.25rem;">
					<div class="menu-row">
						<mitra-icon icon="palette"></mitra-icon>
						<mitra-color-picker .value=${source.color} @change=${(e: CustomEvent) => this.setSourceColor(source, e.detail, (e.currentTarget as HTMLElement).closest('[popover]')!)}></mitra-color-picker>
					</div>
				</div>
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-sidebar': Sidebar
	}
}
