import { Component, component, html, css, property, state, event } from '@a11d/lit'
import { getIntegrations, getMeta, getUser, toggleSourceVisibility, updateSourceColor, renameSource, deleteIntegration, fetchIntegrations, getDefaultSourceId, setDefaultSource, resyncSource, resyncIntegration } from './Api.js'
import { DialogAbout } from './DialogAbout.js'
import { DialogIntegration } from './DialogIntegration.js'
import { SourceType, type Source } from 'shared'
import { outlineStyles } from './components/outlineStyles.js'
import { canInstall, promptInstall, onInstallAvailabilityChange } from './pwa.js'

@component('mitra-sidebar')
export class Sidebar extends Component {
	@event() openChange!: EventDispatcher<boolean>
	@property({ type: Boolean, reflect: true }) open = false

	// The install button appears/disappears with the browser's installability signal (see pwa.ts).
	private unsubscribeInstallAvailability?: () => void

	protected override connected() {
		super.connected()
		this.unsubscribeInstallAvailability = onInstallAvailabilityChange(() => this.requestUpdate())
	}

	protected override disconnected() {
		super.disconnected()
		this.unsubscribeInstallAvailability?.()
	}

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

				/* Three regions: the brand row and the footer never move; only the integrations between
				   them scroll. The nav itself must not scroll, or the brand would ride away with it. */
				nav {
					display: flex;
					flex-direction: column;
					width: 280px;
					height: 100%;
					border-inline-end: 1px solid var(--color-surface);
					padding: 1.5rem 1rem;
					gap: 1rem;
					overflow: hidden;
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

				.account {
					display: flex;
					align-items: center;
					gap: 0.625rem;
					padding: 1rem 0.5rem 0;
					border-top: 1px solid var(--color-surface);

					> mitra-icon {
						font-size: 1.25rem;
						color: var(--color-text-muted);
						flex-shrink: 0;
					}

					.avatar {
						width: 1.75rem;
						height: 1.75rem;
						flex-shrink: 0;
						border-radius: 50%;
						object-fit: cover;
					}

					.who {
						flex: 1;
						min-width: 0;

						.name {
							font-size: 0.8125rem;
							font-weight: 600;
							color: var(--color-text);
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;
						}

						.email {
							font-size: 0.6875rem;
							color: var(--color-text-muted);
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;
						}
					}
				}

				/* The brand row: the one place the app names itself (MITRA_NAME can rename it). The mark is
				   the favicons-generated PNG, so replacing assets/mitra.svg rebrands this too. The version
				   whisper rides at its end, ellipsized when it's a long git-describe string; clicking the
				   row opens the About dialog. Sized to the main header's row (0.75rem padding + content =
				   3.5rem) and pulled up against the nav's own padding, so logo and page title share a line. */
				.brand {
					all: unset;
					box-sizing: border-box;
					display: flex;
					align-items: center;
					gap: 0.625rem;
					height: 3.5rem;
					flex-shrink: 0;
					margin-top: -1.5rem;
					padding-inline: 0.5rem;
					cursor: pointer;
					border-radius: var(--border-radius);

					/* The global button skin's hover/active box is far too loud for a brand mark — the only
					   affordance is the version whisper waking up. */
					&:not(:disabled) {
						&:hover, &:active {
							background: none;
							box-shadow: none;
						}

						&:hover .version {
							opacity: 1;
						}
					}

					img {
						width: 1.375rem;
						height: 1.375rem;
					}

					.name {
						font-size: 0.9375rem;
						font-weight: 600;
						color: var(--color-text);
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
					}

					.version {
						margin-inline-start: auto;
						min-width: 0;
						flex-shrink: 10; /* the long describe strings give way before the name does */
						overflow: hidden;
						white-space: nowrap;
						text-overflow: ellipsis;
						font-size: 0.625rem;
						letter-spacing: 0.02em;
						color: var(--color-text-muted);
						opacity: 0.7;
					}

					${outlineStyles};
				}

				/* The scrolling middle: takes whatever height the brand row and footer leave over. The
				   scrollbar rides the sidebar's edge (the negative margin reclaims the nav's padding, the
				   padding gives it back to the content) as a thin, trackless thumb — barely-there until
				   the list is hovered. */
				.integrations {
					flex: 1;
					min-height: 0;
					overflow-y: auto;
					display: flex;
					flex-direction: column;
					gap: 2rem;
					margin-inline-end: -1rem;
					padding-inline-end: 1rem;
					scrollbar-width: thin;
					scrollbar-color: color-mix(in srgb, var(--color-text) 8%, transparent) transparent;

					&:hover {
						scrollbar-color: color-mix(in srgb, var(--color-text) 22%, transparent) transparent;
					}
				}

				/* Pinned below the scroll region — always visible, however long the source list grows. */
				.footer {
					flex-shrink: 0;
					display: flex;
					flex-direction: column;
					gap: 1rem;
				}

				.add-integration {
					all: unset;
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

						/* Same placement as the source rows' ⋯ menu: to the end of the trigger, top-aligned,
						   flipping above only when there's no room below. */
						menu[popover] {
							position-area: inline-end span-block-end;
							position-try-fallbacks: flip-block;
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
									gap: 0.125rem;
								}

								&[popover] {
									position-area: inline-end span-block-end;
									position-try-fallbacks: flip-block;
								}

								.menu-row {
									display: flex;
									align-items: center;
									gap: 0.625rem;
									padding: 0.375rem 0.5rem;

									> mitra-icon {
										font-size: 0.9rem;
										color: var(--color-text-muted);
									}
								}

								button.menu-row {
									all: unset;
									display: flex;
									align-items: center;
									gap: 0.625rem;
									padding: 0.375rem 0.5rem;
									border-radius: var(--border-radius);
									font-size: 0.8125rem;
									font-weight: 500;
									color: var(--color-text);
									cursor: pointer;

									&:hover {
										background: color-mix(in srgb, var(--color-text) 8%, transparent);
									}

									${outlineStyles};
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

								/* Inline rename: the same label becomes an editable field in place. Let it scroll
								   rather than ellipsis-clip while typing, and give it a field-like outline. */
								&[contenteditable=plaintext-only] {
									cursor: text;
									text-overflow: clip;
									outline: 1px solid var(--color-accent, var(--color-text-muted));
									outline-offset: 2px;
									border-radius: 2px;
								}
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

	/** The source whose name row is currently in inline-edit mode (double-click or ⋯ → Rename). */
	@state() private renamingId?: string

	/** Enter the name row's inline edit, then select its whole text so a rename is a single overtype. */
	private async startRename(source: Source) {
		this.renamingId = source.id
		await this.updateComplete
		const el = this.querySelector<HTMLElement>(`.name[data-rename-id="${source.id}"]`)
		if (!el) {
			return
		}
		el.focus()
		getSelection()?.selectAllChildren(el)
		// Launched from the ⋯ menu, close it now — AFTER moving focus to the field, so the popover's
		// focus-restore doesn't yank focus back to its trigger (which would blur → commit → exit).
		const menu = this.querySelector<HTMLElement>(`#source-menu-${source.id}`)
		if (menu?.matches(':popover-open')) {
			menu.hidePopover()
		}
	}

	private handleRenameKeydown(e: KeyboardEvent, source: Source) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLElement).blur() // → commit
		} else if (e.key === 'Escape') {
			e.preventDefault()
			this.cancelRename(source, e.target as HTMLElement)
		}
	}

	/** Persist the edited name (on blur, whether via Enter or clicking away). Guarded so the blur that
	 * follows a cancel — which has already cleared the flag — is a no-op rather than a re-save. */
	private async commitRename(source: Source, el: HTMLElement) {
		if (this.renamingId !== source.id) {
			return
		}
		this.renamingId = undefined
		const name = (el.textContent ?? '').trim()
		if (name && name !== source.name) {
			await renameSource(source.id, name)
			source.name = name
		}
		this.requestUpdate()
	}

	private cancelRename(source: Source, el: HTMLElement) {
		this.renamingId = undefined
		// Lit won't reset text the user typed into the contenteditable (its recorded value is unchanged),
		// so restore the original label ourselves before the blur-triggered commit sees it.
		el.textContent = source.name
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

	/** What the brand row admits about the build: a bare `dev` when the build is main past the last tag
	 * (the rolling `dev` image — and a git-less local fallback), otherwise the version as it is — the
	 * tag on a release, the whole describe string for anything murkier: dirty trees, pre-release tags,
	 * tagless clones. */
	private get versionLabel() {
		return mitra.version === 'dev' || /^v\d.*-\d+-g[0-9a-f]+$/.test(mitra.version) ? 'dev' : mitra.version
	}

	protected override get template() {
		return html`
			<div class="backdrop" ?data-open=${this.open} @click=${() => this.openChange.dispatch(false)}></div>
			<nav ?data-open=${this.open}>
				<button class="brand" title=${`Mitra ${mitra.version}`} @click=${() => new DialogAbout().confirm()}>
					<img src="/android-chrome-192x192.png" alt="">
					<span class="name">${getMeta()?.name ?? 'Mitra'}</span>
					<span class="version">${this.versionLabel}</span>
				</button>
				<div class="integrations">
					${getIntegrations().map(i => html`
						<div class="integration">
							<header>
								<span class="title">${i.credentials?.username || i.type}</span>
								<mitra-icon-button icon="more-horizontal" label=${t('Integration options')} style="anchor-name: --anchor-${i.id}" @click=${this.toggleMenu}></mitra-icon-button>
								<menu popover id="menu-${i.id}" style="position-anchor: --anchor-${i.id}">
									<button @click=${(e: Event) => { this.closeMenu(e); this.openDialog(i.id) }}>
										<mitra-icon icon="pencil"></mitra-icon>
										${t('Edit')}
									</button>
									<button
										title=${t('Delete the locally cached entries of every enabled source and import everything again')}
										@click=${(e: Event) => { this.closeMenu(e); resyncIntegration(i.id).catch(() => void 0) }}>
										<mitra-icon icon="refresh-cw"></mitra-icon>
										${t('Re-import entries')}
									</button>
									<button class="danger" @click=${(e: Event) => { this.closeMenu(e); this.removeIntegration(i.id) }}>
										<mitra-icon icon="trash-2"></mitra-icon>
										${t('Delete')}
									</button>
								</menu>
							</header>
							<div class="sources">
								${i.sources.filter(source => source.enabled).map(source => html`
									<div class="source" ?data-hidden=${source.hidden}>
										<button class="marker" @click=${() => this.toggleDefault(source)}
											title=${this.isDefault(source) ? t('Default for new entries — click to unset') : t('Set as the default for new entries')}>
											<mitra-icon icon=${this.isDefault(source) ? 'star' : 'square'} fill style="color: ${source.color || 'var(--color-text-muted)'}"></mitra-icon>
										</button>
										<mitra-icon
											class="type-icon"
											icon=${source.type === SourceType.Task ? 'list-todo' : 'calendar'}
											title=${source.type === SourceType.Task ? t('Tasks') : t('Events')}
										></mitra-icon>
										${this.getNameTemplate(source)}
										${this.getActionsTemplate(source)}
									</div>
							`)}
							</div>
						</div>
				`)}
				</div>
				<div class="footer">
					<button class="add-integration" @click=${() => this.openDialog('')}>
						<mitra-icon icon="plus"></mitra-icon>
						${t('Add Integration')}
					</button>
					${!canInstall() ? html.nothing : html`
						<button class="add-integration"
							title=${t('Install mitra as an app — it gets its own window, and notifications appear under its own name and icon')}
							@click=${() => promptInstall()}>
							<mitra-icon icon="monitor-down"></mitra-icon>
							${t('Install as an App')}
						</button>
					`}
					${this.accountTemplate}
				</div>
			</nav>
		`
	}

	// A provider photo that fails to load (link rotated, endpoint needs auth) falls back to the icon.
	@state() private profilePictureBroken = false

	/** Who is signed in + sign-out — only in multi-user (OIDC) mode, marked by the user carrying an identity. */
	private get accountTemplate() {
		const identity = getUser()?.identity
		return !identity ? html.nothing : html`
			<div class="account">
				${identity.picture && !this.profilePictureBroken
					? html`<img class="avatar" src=${identity.picture} alt="" referrerpolicy="no-referrer" @error=${() => this.profilePictureBroken = true}>`
					: html`<mitra-icon icon="circle-user"></mitra-icon>`}
				<div class="who">
					<div class="name">${identity.name || identity.email || t('Account')}</div>
					${!identity.email || identity.email === identity.name ? html.nothing : html`<div class="email">${identity.email}</div>`}
				</div>
				<mitra-icon-button icon="log-out" label=${t('Sign out')} style="color: var(--color-text-muted)"
					@click=${() => location.assign('/auth/logout')}></mitra-icon-button>
			</div>
		`
	}

	// The source's label doubles as its inline rename field: `contenteditable` is toggled on by
	// renamingId (via double-click or ⋯ → Rename). Enter/blur commit, Escape reverts.
	private getNameTemplate(source: Source) {
		return html`
			<div
				class="name"
				data-rename-id=${source.id}
				title=${`${source.name} — ${t('Double-click to rename')}`}
				contenteditable=${this.renamingId === source.id ? 'plaintext-only' : 'false'}
				@dblclick=${() => this.startRename(source)}
				@keydown=${(e: KeyboardEvent) => this.handleRenameKeydown(e, source)}
				@blur=${(e: Event) => this.commitRename(source, e.target as HTMLElement)}
			>${source.name}</div>
		`
	}

	private getActionsTemplate(source: Source) {
		return html`
			<div class="actions">
				<mitra-icon-button
					class="eye-icon"
					style='color: var(--color-text-muted)'
					icon=${source.hidden ? 'eye-off' : 'eye'}
					label=${source.hidden ? t('Show calendar') : t('Hide calendar')}
					@click=${() => this.toggleVisibility(source)}
				></mitra-icon-button>
				<mitra-icon-button
					class="menu-icon"
					icon="more-horizontal"
					label=${t('Calendar options')}
					style="anchor-name: --source-menu-${source.id}; color: var(--color-text-muted)"
					@click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement)?.togglePopover()}
				></mitra-icon-button>
				<div popover id="source-menu-${source.id}" class="source-menu" style="position-anchor: --source-menu-${source.id}">
					<button class="menu-row" @click=${() => this.startRename(source)}>
						<mitra-icon icon="pencil"></mitra-icon>
						${t('Rename')}
					</button>
					<div class="menu-row">
						<mitra-icon icon="palette"></mitra-icon>
						<mitra-color-picker .value=${source.color} @change=${(e: CustomEvent) => this.setSourceColor(source, e.detail, (e.currentTarget as HTMLElement).closest('[popover]')!)}></mitra-color-picker>
					</div>
					<button class="menu-row"
						title=${t('Delete the locally cached entries and import everything from the source again')}
						@click=${(e: Event) => { this.closeMenu(e); resyncSource(source.id).catch(() => void 0) }}>
						<mitra-icon icon="refresh-cw"></mitra-icon>
						${t('Re-import entries')}
					</button>
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
