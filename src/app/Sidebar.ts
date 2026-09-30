import { Component, component, html, css, property, state, event, eventListener, unsafeCSS, ifDefined } from '@a11d/lit'
import { getIntegrations, getMeta, getUser, instanceName, isBundleStale, refreshMetaIfStale, toggleSourceVisibility, updateSourceColor, renameSource, deleteIntegration, fetchIntegrations, getDefaultSourceId, getPrimarySource, setDefaultSource, reimportSource, reimportIntegration, reorderSources, reorderIntegrations, getEnabledSources, getVisibleSources, soloSource, restoreSourceVisibility, canRestoreSourceVisibility, canCopyEntriesOut, canMoveEntriesOut, getCapabilities, createSource } from '../infrastructure/http/Api.js'
import { DialogAbout, hasUnseenChanges } from '../features/about/client/DialogAbout.js'
import { DialogIntegration } from '../integrations/client/DialogIntegration.js'
import { DialogSourceMigration } from '../features/migration/client/DialogSourceMigration.js'
import { DialogSourceDeletion } from '../features/sources/client/DialogSourceDeletion.js'
import { type Source } from '../features/sources/Source.js'
import { Color } from '../features/sources/Color.js'
import { integrationClasses, type Integration } from '../integrations/Integration.js'
import { ReorderabilityController, ReorderabilityState } from '@3mo/reorderability'
import { focusRing } from '../design/focusRing.css.js'
import { windowDragHandle } from '../design/windowDrag.css.js'
import { EntryStore } from '../features/entries/client/EntryStore.js'
import { Planning } from '../features/planning/client/Planning.js'
import { canInstall, promptInstall, onInstallAvailabilityChange } from './pwa.js'
import { scrollbar } from '../design/scrollbar.css.js'
import { MediaQueryController } from '@3mo/media-query-observer'

@component('mitra-sidebar')
export class Sidebar extends Component {
	@event() readonly openChange!: EventDispatcher<boolean>
	@event() readonly sourcesChange!: EventDispatcher
	/** The calendar page owns opening it, so the URL can carry the page it lands on. */
	@event({ bubbles: true, composed: true }) readonly settingsClick!: EventDispatcher
	@property({ type: Boolean, reflect: true }) open = false

	@state() private tab: 'calendars' | 'planning' = (localStorage.getItem('Mitra.SidebarTab') as 'planning' | null) ?? 'calendars'

	readonly store = new EntryStore(this)

	private get planningCount() {
		return Planning.pending
	}

	private setTab(tab: 'calendars' | 'planning') {
		this.tab = tab
		localStorage.setItem('Mitra.SidebarTab', tab)
	}

	/** Drag-to-reorder controller for top-level integrations. */
	private readonly integrationsReorder = new ReorderabilityController(this, {
		handleReorder: (source, destination) => {
			const ids = getIntegrations().map(integration => integration.id)
			this.commitOrder(ids, source, destination, () => reorderIntegrations(ids))
		},
	})

	/** Per-integration drag-to-reorder controllers for child sources. */
	private readonly sourcesReorder = new Map<string, ReorderabilityController>()

	private sourcesReorderOf(integration: Integration) {
		let controller = this.sourcesReorder.get(integration.id)
		if (!controller) {
			const id = integration.id
			controller = new ReorderabilityController(this, {
				// Looked up per drag: the controller outlives the integration object every refetch replaces.
				handleReorder: (source, destination) => {
					const current = getIntegrations().find(integration => integration.id === id)
					if (!current) {
						return
					}
					const ids = getEnabledSources(current).map(source => source.id)
					this.commitOrder(ids, source, destination, () => reorderSources(current, ids))
				},
			})
			this.sourcesReorder.set(integration.id, controller)
		}
		return controller
	}

	/** Move items optimistically and persist the new order to the backend. */
	private commitOrder(ids: Array<string>, from: number, to: number, commit: () => Promise<unknown>) {
		if (from === to || from < 0 || to < 0 || to >= ids.length) {
			return
		}
		ids.splice(to, 0, ...ids.splice(from, 1))
		const request = commit()
		this.requestUpdate()
		request.catch(async () => {
			await fetchIntegrations()
			this.requestUpdate()
		})
	}

	private unsubscribeInstallAvailability?: () => void

	protected override connected() {
		super.connected()
		this.unsubscribeInstallAvailability = onInstallAvailabilityChange(() => this.requestUpdate())
	}

	protected override disconnected() {
		super.disconnected()
		this.unsubscribeInstallAvailability?.()
	}

	/** Re-check metadata on visibility change. */
	@eventListener({ target: document, type: 'visibilitychange' })
	protected async refreshMeta() {
		if (document.visibilityState === 'visible') {
			await refreshMetaIfStale()
			this.requestUpdate()
		}
	}

	static override get styles() {
		return css`
			@property --sidebar-fade {
				syntax: '<length>';
				inherits: false;
				initial-value: 0px;
			}

			/* How far the list's bottom edge dissolves while there's more below it. Idle (and so absent)
			   whenever the list fits: a scroll() timeline on a non-scrollable box is inactive, which
			   leaves --sidebar-fade at its 0px initial value. */
			@keyframes sidebar-scroll-fade {
				from { --sidebar-fade: 1.25rem; }
				to { --sidebar-fade: 0px; }
			}

			mitra-sidebar {
				/* Only the three lengths that two distant rules must agree on live here. The source list's
				   columns are laid out by ONE grid the rows subscribe to (see .integrations), not by an
				   arithmetic of per-element paddings. */
				--sidebar-width: 16rem;
				--sidebar-inset: 0.5rem;
				/* Source list column gap and row content inset, aligning headings across tabs. */
				--sidebar-gap: 0.5rem;

				--mitra-modal-sheet-size: var(--sidebar-width);

				display: flex;
				flex-direction: column;
				transition: margin-inline-start 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
				z-index: 1000;

				&:not([open]) {
					margin-inline-start: calc(-1 * var(--sidebar-width));
					opacity: 0;
					pointer-events: none;
				}

				/* A narrow screen has no column to spare: the nav is a sheet over the calendar (see the template). */
				@media (max-width: 800px) {
					display: contents;
				}

				/* Three regions: the brand row and the footer never move; only the integrations between
				   them scroll. The nav itself must not scroll, or the brand would ride away with it. */
				nav {
					display: flex;
					flex-direction: column;
					width: var(--sidebar-width);
					height: 100%;
					/* Mixed from the text colour, not --color-surface: surface is LIGHTER than the background
					   in light mode, so that border read as a bevel, or as nothing at all. */
					border-inline-end: 1px solid color-mix(in srgb, var(--color-text) 9%, transparent);
					padding: 1.5rem var(--sidebar-inset) var(--sidebar-inset);
					gap: 1rem;
					overflow: hidden;
					box-sizing: border-box;
					font-family: var(--font-family);
					background-color: transparent;

					@media (max-width: 800px) {
						flex: 1;
						min-block-size: 0;
						inline-size: auto;
						border-inline-end: none;
					}

					/* Window Controls Overlay (see PageCalendar's header): with the OS title bar gone, the
					   sidebar's dead space becomes the window-drag handle. On macOS the window buttons overlay
					   its top-leading corner, so the first row also drops below the button band. The clamp is
					   the band height where the buttons are actually on the leading side (titlebar-area-x ≈
					   their width) and collapses to 0 on Windows/Linux (x = 0), wasting no space there. */
					@media (display-mode: window-controls-overlay) {
						padding-top: calc(1.5rem + min(env(titlebar-area-x, 0px), env(titlebar-area-height, 0px)));

						/* The column carries the window; everything in it stays the app's (windowDrag.css.ts).
						   This is what keeps the tabs clickable and swipeable and the whole planning list live
						   and what keeps the NEXT thing added here live without anyone remembering to. */
						${windowDragHandle};

						/* The one part of the column that is inert on purpose: the brand mark carries the
						   window, so the logo moves it. Its version whisper does not: it stays live (see
						   .version), which is what keeps About reachable from a row that drags. */
						.brand, .brand :is(.mark, img, .name) {
							-webkit-app-region: drag;
						}
					}
				}

				/* User account card footer in multi-user mode. */
				.account {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					margin-block-start: 0.5rem;
					padding: 0.5rem 0.5rem 0.5rem 0.4375rem;
					background: var(--color-surface);
					border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
					border-radius: 0.5rem;

					mitra-avatar {
						--mitra-avatar-size: 2rem;
					}

					> mitra-icon-button {
						color: var(--color-text-muted);
					}

					/* The menu holding the rare action keeps to itself until the card is reached for, the
					   same bargain a source row's ⋯ strikes with its eye. Focus and an open menu pin it, so
					   it never fades out from under itself. */
					.actions mitra-icon-button {
						opacity: 0;
						transition: opacity 0.15s ease;
					}

					&:hover .actions mitra-icon-button,
					&:focus-within .actions mitra-icon-button,
					&:has(mitra-menu:popover-open) .actions mitra-icon-button {
						opacity: 1;
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
							font-size: 0.75rem;
							color: color-mix(in srgb, var(--color-text) 65%, transparent);
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
					border-radius: 0.375rem;

					/* The global button skin's hover/active box is far too loud for a brand mark. The only
					   affordance is the version whisper waking up. */
					&:not(:disabled) {
						&:hover, &:active {
							background: none;
							box-shadow: none;
						}

						&:hover .version .label {
							opacity: 1;
						}
					}

					img {
						width: 1.375rem;
						height: 1.375rem;
					}

					/* The update badge: a quiet accent dot on the mark's corner, with no text, no animation;
					   the row's title whispers what it means, the About dialog carries the detail. */
					.mark {
						position: relative;
						display: inline-flex;
						flex-shrink: 0;

						.dot {
							position: absolute;
							top: -2px;
							right: -3px;
							width: 6px;
							height: 6px;
							border-radius: 50%;
							background: var(--color-accent);
							/* ringed with the sidebar's background so it reads on the mark's own pixels */
							box-shadow: 0 0 0 2px var(--color-background);
						}
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
						display: inline-flex;
						align-items: center;
						gap: 0.25rem;
						font-size: 0.625rem;
						letter-spacing: 0.02em;
						color: var(--color-text-muted);

						/* Dimmed on the text only, since the news dot inside must keep its full accent. */
						.label {
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							opacity: 0.7;
						}

						/* The news dot: the instance moved since this user last opened What's New. Quiet by
						   design: no toast, no auto-opened dialog; it goes out when What's New is opened
						   (About → What's New, or the palette command). */
						.news-dot {
							flex-shrink: 0;
							width: 6px;
							height: 6px;
							border-radius: 50%;
							background: var(--color-accent);
						}

						/* Under Window Controls Overlay the brand row drags the window, making this whisper
						   the row's only click-through to About. It is already live (the handle hands every
						   element back), so all it needs here is a real hit area and a hover affordance. */
						@media (display-mode: window-controls-overlay) {
							cursor: pointer;
							padding: 0.125rem 0.375rem;
							margin-inline-end: -0.375rem;
							border-radius: var(--border-radius);

							&:hover {
								background: color-mix(in srgb, var(--color-text) 8%, transparent);

								.label {
									opacity: 1;
								}
							}
						}
					}

					${focusRing};
				}

				/* The scrolling middle: takes whatever height the brand row and footer leave over.

				   It is also THE grid. One set of columns (marker | name | actions, between two zero-width
				   edge tracks) is declared here, and every account heading and every source row subscribes
				   to it through subgrid. A heading's ⋯ and a row's ⋯ then sit in the same track instead of
				   being talked into the same place by matching paddings. The edge tracks are what inset a
				   row's content from its own hover chip: padding cannot do that job here, because padding on
				   a subgrid item shifts its tracks off the parent's, the very misalignment this prevents.

				   The thumb rides the nav's own inline padding, clear of the content: the negative margin
				   lets the box reach the divider, scrollbar-gutter: stable reserves the thumb's lane whether
				   or not it is showing, and the padding left over is the exact complement of it. Without the
				   reserved gutter a classic scrollbar eats into the CONTENT box, so the whole list used to
				   jump inward by the thumb's width the moment one more source made it overflow. The lane is
				   sized here rather than left to scrollbar-width: thin, whose width is the UA's to pick (and
				   which draws stepper arrows on Windows). */
				/* The tabs take the column between the brand and the footer; each panel then gives its
				   list the height and pins its action to the foot. Without this the panels are only as
				   tall as their content and both buttons end up floating mid-column. */
				mitra-tabs {
					flex: 1;
					min-height: 0;
				}

				mitra-tab-panel > .integrations,
				mitra-tab-panel > mitra-planning {
					flex: 1;
					min-height: 0;
				}

				/* Align the planning headings with the account headings grid column. */
				mitra-tab-panel > mitra-planning > section > header {
					padding-inline-start: var(--sidebar-gap);
				}

				mitra-tab-panel > .action {
					flex-shrink: 0;
					margin-block-start: 0.5rem;
				}

				.integrations {
					flex: 1;
					min-height: 0;
					overflow-y: auto;
					display: grid;
					grid-template-columns: 0 auto 1fr auto 0;
					align-content: start;
					column-gap: var(--sidebar-gap);
					row-gap: 1.5rem;
					margin-inline-end: calc(-1 * var(--sidebar-inset));
					${scrollbar};
					padding-inline-end: calc(var(--sidebar-inset) - var(--scrollbar-width));
					scrollbar-gutter: stable;
					/* Dissolves the bottom edge while there's more list below, so a row is never sliced flat
					   against the footer. */
					mask-image: linear-gradient(to bottom, #000 calc(100% - var(--sidebar-fade)), transparent);
					animation: sidebar-scroll-fade linear both;
					animation-timeline: scroll(self);
					animation-range: calc(100% - 1.25rem) 100%;
				}

				/* Each level down to the row hands the same columns on, unchanged. */
				.integration, .integration > header, .sources, .source {
					grid-column: 1 / -1;
					display: grid;
					grid-template-columns: subgrid;
					align-items: center;
				}

				.integration { row-gap: 0.5rem; }
				.sources { row-gap: 0.125rem; }

				/* Reordering (@3mo/reorderability): while a drag is in flight THIS element carries
				   [data-reordering] and the grabbed item [data-reorderability=dragging]. The siblings
				   glide aside, the grabbed one rides the pointer raw (its transform is driven per frame).
				   Everything is transforms only, so the subgrid tracks the alignment rests on are never
				   touched; the attributes and transforms clear together on release, and the store's
				   re-sorted render lands in the same task, so the settled order paints exactly once,
				   transition-free, which is why this transition is scoped to the attribute. */
				&[data-reordering] {
					.source:not([data-reorderability=${unsafeCSS(ReorderabilityState.Dragging)}]),
					.integration:not([data-reorderability=${unsafeCSS(ReorderabilityState.Dragging)}]) {
						transition: transform 0.15s ease;
					}
				}

				/* The account a group of sources came from. Its title is the block's drag handle, hence
				   the grab cursor and no text selection there (the ⋯ beside it stays a plain button). */
				.integration > header {
					font-size: 0.75rem;
					font-weight: 600;
					color: var(--color-text-muted);

					.title {
						grid-column: 2 / 4;
						min-width: 0;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
						cursor: grab;
						user-select: none;
					}

					> mitra-popover-container > mitra-icon-button {
						grid-column: 4;
						justify-self: end;
					}
				}

				.source {
					min-height: 1.75rem;
					border-radius: 0.375rem;
					/* The whole row is its own drag handle: a mouse drag must never start a text
					   selection, and the grab cursor is the affordance; the row's own controls keep their
					   pointer cursors, and the rename field restores text behaviour below. */
					cursor: grab;
					user-select: none;

					&:hover {
						background-color: color-mix(in srgb, var(--color-text) 6%, transparent);
						.actions mitra-icon-button { opacity: 1; }
					}

					/* Keep the actions visible while this row's menu popover is open, so the 3-dot doesn't
					   fade out from under its own menu when the pointer leaves the row. Ditto while anything
					   in the row holds focus, since tabbing into a transparent button used to park the focus ring
					   on something invisible. */
					&:focus-within .actions mitra-icon-button,
					&:has(mitra-menu:popover-open) .actions mitra-icon-button {
						opacity: 1;
					}

					/* A hidden source recedes, and keeps its eye showing so it can be brought back. The eye is
					   the LAST action for exactly that reason: being the only one left on an unhovered row,
					   anywhere else would leave it floating short of the trailing edge. */
					&[data-hidden] {
						.marker { opacity: 0.4; }
						.name { color: var(--color-text-muted); }
						.actions .eye-icon { opacity: 1; }
					}

					/* The leading marker is the shared source icon (see SourceIcon). The glyph, the colour, the
					   filled state and its geometry all belong to it. This is only what makes it clickable:
					   clicking toggles whether the source is the default for new entries. */
					.marker {
						/* The all: unset comes first: it resets grid-column too, so placing the marker above
						   it would put the icon back in the edge track. */
						all: unset;
						grid-column: 2;
						display: inline-flex;
						border-radius: 0.375rem;
						cursor: pointer;
						${focusRing};
					}

					.name {
						grid-column: 3;
						min-width: 0;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
						font-size: 0.8125rem;
						color: var(--color-text);

						/* Inline rename: the same label becomes an editable field in place. Let it scroll rather
						   than ellipsis-clip while typing, and give it a field-like outline. */
						&[contenteditable=plaintext-only] {
							cursor: text;
							user-select: text;
							text-overflow: clip;
							outline: 1px solid var(--color-accent, var(--color-text-muted));
							outline-offset: 2px;
							border-radius: 2px;
						}
					}

					.actions {
						grid-column: 4;
						display: flex;
						align-items: center;
						gap: 0.125rem;

						mitra-icon-button {
							color: var(--color-text-muted);
							transition: opacity 0.15s ease;

							@media (hover: hover) {
								opacity: 0;
							}
						}
					}
				}

				/* The grabbed row/block lifts above its gliding siblings on an opaque backing, after the
				   hover rule, so the lift's backing wins over the row's own hover chip while it's carried. */
				.source[data-reorderability=${unsafeCSS(ReorderabilityState.Dragging)}], .integration[data-reorderability=${unsafeCSS(ReorderabilityState.Dragging)}] {
					z-index: 5;
					background-color: var(--color-background);
					border-radius: 0.375rem;
					box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.25);
					cursor: grabbing;
				}

				/* The trailing icon buttons bleed their glyph inset back out, so it is the GLYPHS that land on the
				   trailing edge. Aligning the boxes instead leaves every icon a few pixels short of the text above. */
				.integration > header > mitra-popover-container > mitra-icon-button, .actions > mitra-icon-button:last-child, .account > mitra-icon-button:last-child {
					margin-inline-end: calc(-1 * var(--mitra-glyph-inset));
				}

				/* Pinned below the scroll region, always visible, however long the source list grows. */
				.footer {
					flex-shrink: 0;
					display: flex;
					flex-direction: column;
					gap: 0.375rem;
				}

				/* Sized to a source row rather than to its own padding, which is where the footer's height
				   went: two of these plus a 1rem gap used to cost as much as three source rows. */
				/* Outlined: the sidebar's own surface shows through until a hover fills them. */
				.action {
					color: var(--color-text-muted);

					&::part(button):not(:hover, :active) {
						background: transparent;
					}
				}

				/* A 280px column has no room to drop a menu below its trigger, so they open off its inline end. */
				mitra-menu {
					margin: 0;
					position-area: inline-end span-block-end;
					position-try-fallbacks: flip-block;

					.color-row {
						display: flex;
						align-items: center;
						gap: 0.5rem;
						padding: 0.25rem 0.625rem;

						> mitra-icon {
							font-size: 1rem;
						}
					}
				}

				/* A source's menu opens past its whole cluster of actions rather than over its eye. */
				.source .actions {
					anchor-name: --source-actions;
					anchor-scope: --source-actions;

					mitra-menu {
						position-anchor: --source-actions;
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
		this.visibilityChanged()
	}

	/** Toggle solo visibility for the given source. */
	private async toggleSolo(source: Source) {
		await (canRestoreSourceVisibility() ? restoreSourceVisibility() : soloSource(source.id))
		this.visibilityChanged()
	}

	private visibilityChanged() {
		this.requestUpdate()
		this.sourcesChange.dispatch()
	}

	private isOnlyVisible(source: Source) {
		const visible = getVisibleSources()
		return visible.length === 1 && visible[0]?.id === source.id
	}

	@state() private renamingId?: string

	/** Enter inline rename mode for the given source. */
	private async startRename(source: Source) {
		this.renamingId = source.id
		await this.updateComplete
		const el = this.querySelector<HTMLElement>(`.name[data-rename-id="${source.id}"]`)
		if (!el) {
			return
		}
		el.focus()
		getSelection()?.selectAllChildren(el)
	}

	private handleRenameKeydown(e: KeyboardEvent, source: Source) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLElement).blur()
		} else if (e.key === 'Escape') {
			e.preventDefault()
			this.cancelRename(source, e.target as HTMLElement)
		}
	}

	/** Persist edited source name on blur. */
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
		el.textContent = source.name
	}

	/** Check whether the source is the default target for new entries. */
	private isDefault(source: Source) {
		return getPrimarySource()?.id === source.id
	}

	/** Tooltip hint for source default marker. */
	private defaultHint(source: Source) {
		if (source.importing) {
			return t('Importing entries…')
		}
		if (!this.isDefault(source)) {
			return t('Set as the default for new entries')
		}
		return getDefaultSourceId() === source.id
			? t('Default for new entries. Click to unset')
			: t('Default for new entries, as the first one shown')
	}

	/** Set or toggle custom default source. */
	private async toggleDefault(source: Source) {
		const stored = getDefaultSourceId() === source.id
		if (this.isDefault(source) && !stored) {
			return
		}
		await setDefaultSource(stored ? undefined : source.id)
		this.requestUpdate()
	}

	private async openDialog(id?: string) {
		await new DialogIntegration({ id }).confirm()
		this.requestUpdate()
	}

	private async removeIntegration(id: string) {
		await deleteIntegration(id)
		await fetchIntegrations()
		this.requestUpdate()
	}

	/** Shift source order by delta within its integration. */
	/** Falls back to the integration name when there is no account, like Mitra. */
	private integrationTitle(integration: Integration) {
		const label = integrationClasses().find(integrationClass => integrationClass.type === integration.type)?.label
		return integration.credentials?.username || (label ? String(t(label)) : integration.type)
	}

	private async addSource(integration: Integration) {
		const source = await createSource(integration.id, { name: String(t('Calendar')) })
		await fetchIntegrations()
		this.sourcesChange.dispatch()
		await this.startRename(source)
	}

	private async removeSource(source: Source) {
		if (await DialogSourceDeletion.confirmAndDelete(source)) {
			this.requestUpdate()
			this.sourcesChange.dispatch()
		}
	}

	private moveSource(integration: Integration, source: Source, delta: number) {
		const ids = getEnabledSources(integration).map(source => source.id)
		const index = ids.indexOf(source.id)
		this.commitOrder(ids, index, index + delta, () => reorderSources(integration, ids))
	}

	private moveIntegration(id: string, delta: number) {
		const ids = getIntegrations().map(integration => integration.id)
		const index = ids.indexOf(id)
		this.commitOrder(ids, index, index + delta, () => reorderIntegrations(ids))
	}

	/** Formatted build version label. */
	private get versionLabel() {
		return mitra.version === 'dev' || /^v\d.*-\d+-g[0-9a-f]+$/.test(mitra.version) ? 'dev' : mitra.version
	}

	/** Update availability tooltip text. */
	private get updateHint() {
		if (isBundleStale()) {
			return t('Reload to finish updating')
		}
		const update = getMeta()?.update
		return !update ? undefined : t('Update available: ${version}', { version: update.version })
	}

	private get calendarsTemplate() {
		return html`
			<div class="integrations">
				${getIntegrations().map((i, index, integrations) => html`
					<div class="integration" ${this.integrationsReorder.item({ index, handle: '.title' })}>
						<header>
							<span class="title">${this.integrationTitle(i)}</span>
							<mitra-popover-container>
								<mitra-icon-button size="small" icon="more-horizontal" label=${t('Integration options')}></mitra-icon-button>
								<mitra-menu slot="popover">
									${!i.capabilities.createSources ? html.nothing : html`
										<mitra-menu-item icon="plus" @click=${() => void this.addSource(i)}>${t('New calendar')}</mitra-menu-item>
									`}
									<mitra-menu-item icon="pencil" @click=${() => this.openDialog(i.id)}>${t('Edit')}</mitra-menu-item>
									<mitra-menu-item icon="arrow-up" ?disabled=${index === 0} @click=${() => this.moveIntegration(i.id, -1)}>${t('Move up')}</mitra-menu-item>
									<mitra-menu-item icon="arrow-down" ?disabled=${index === integrations.length - 1} @click=${() => this.moveIntegration(i.id, 1)}>${t('Move down')}</mitra-menu-item>
									${!i.reimportable ? html.nothing : html`
										<mitra-menu-item icon="hard-drive-download" title=${t('Read every enabled calendar of this account again from the start')}
											@click=${() => void reimportIntegration(i.id).catch(() => void 0)}>${t('Re-import entries')}</mitra-menu-item>
									`}
									<mitra-menu-item icon="trash-2" variant="danger" @click=${() => this.removeIntegration(i.id)}>${t('Delete')}</mitra-menu-item>
								</mitra-menu>
							</mitra-popover-container>
						</header>
						<div class="sources">
							${getEnabledSources(i).map((source, sourceIndex, sources) => html`
								<div class="source" ${this.sourcesReorderOf(i).item({ index: sourceIndex })} ?data-hidden=${source.hidden}>
									<button class="marker"
										@click=${() => this.toggleDefault(source)}
										title=${this.defaultHint(source)}>
										<mitra-source-icon .source=${source} ?selected=${this.isDefault(source)}></mitra-source-icon>
									</button>
									${this.getNameTemplate(source)}
									${this.getActionsTemplate(i, source, sourceIndex, sources.length)}
								</div>
						`)}
						</div>
					</div>
			`)}
			</div>
			${getMeta()?.demo ? html.nothing : html`
				<mitra-button class="action" @click=${() => this.openDialog()}>
					<mitra-icon icon="plus"></mitra-icon>
					${t('Add Integration')}
				</mitra-button>
			`}
		`
	}

	private get planningTemplate() {
		return html`
			<mitra-planning></mitra-planning>
			${!Planning.canAdd ? html.nothing : html`
				<mitra-button class="action" @click=${() => Planning.add()}>
					<mitra-icon icon="plus"></mitra-icon>
					${t('Add Task')}
				</mitra-button>
			`}
		`
	}

	private readonly narrow = new MediaQueryController(this, '(max-width: 800px)')

	protected override get template() {
		return !this.narrow.matches ? this.navTemplate : html`
			<mitra-modal-sheet placement="inline-start" label=${instanceName()} ?open=${this.open}
				@openChange=${(e: CustomEvent<boolean>) => e.detail !== this.open && this.openChange.dispatch(e.detail)}
			>${this.navTemplate}</mitra-modal-sheet>
		`
	}

	private get navTemplate() {
		return html`
			<nav>
				<button class="brand" title=${[`Mitra ${mitra.version}`, this.updateHint].filter(Boolean).join('\n')} @click=${() => new DialogAbout().confirm()}>
					<span class="mark">
						<img src="/android-chrome-192x192.png" alt="">
						${!this.updateHint ? '' : html`<span class="dot"></span>`}
					</span>
					<span class="name">${instanceName()}</span>
					<span class="version">
						<span class="label">${this.versionLabel}</span>
						${this.updateHint || !hasUnseenChanges() ? html.nothing : html`<span class="news-dot" title=${t('What\'s New')}></span>`}
					</span>
				</button>
				<mitra-tabs .selected=${this.tab} @selectedChange=${(e: CustomEvent<string>) => this.setTab(e.detail as 'calendars' | 'planning')}>
					<mitra-tab name="calendars" icon="calendar-days">${t('Calendars')}</mitra-tab>
					<mitra-tab-panel name="calendars">${this.calendarsTemplate}</mitra-tab-panel>

					<mitra-tab name="planning" icon="list-todo" .badge=${this.planningCount}>${t('Planning')}</mitra-tab>
					<mitra-tab-panel name="planning">${this.planningTemplate}</mitra-tab-panel>
				</mitra-tabs>
				<div class="footer">
					${getUser()?.identity ? html.nothing : html`
						<mitra-button class="action" title=${t('Settings')} @click=${() => this.settingsClick.dispatch()}>
							<mitra-icon icon="settings"></mitra-icon>
							${t('Settings')}
						</mitra-button>
					`}
					${!canInstall() ? html.nothing : html`
						<mitra-button class="action"
							title=${t('Install mitra as an app. It gets its own window, and notifications appear under its own name and icon')}
							@click=${() => promptInstall()}>
							<mitra-icon icon="monitor-down"></mitra-icon>
							${t('Install as an App')}
						</mitra-button>
					`}
					${this.accountTemplate}
				</div>
			</nav>
		`
	}

	@eventListener({ target: window, type: 'keydown' })
	protected handleSettingsHotkey(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === ',' && !document.querySelector('mitra-dialog-settings')) {
			e.preventDefault()
			this.settingsClick.dispatch()
		}
	}


	/** User account footer for multi-user mode. */
	private get accountTemplate() {
		const identity = getUser()?.identity
		return !identity ? html.nothing : html`
			<div class="account">
				<mitra-avatar src=${ifDefined(identity.picture ?? undefined)}></mitra-avatar>
				<div class="who">
					<div class="name">${identity.name || identity.email || t('Account')}</div>
					${!identity.email || identity.email === identity.name ? html.nothing : html`<div class="email">${identity.email}</div>`}
				</div>
				<span class="actions">
					<mitra-popover-container>
						<mitra-icon-button icon="more-horizontal" label=${t('Account options')}></mitra-icon-button>
						<mitra-menu slot="popover">
							<mitra-menu-item icon="log-out" @click=${() => location.assign('/auth/logout')}>${t('Sign out')}</mitra-menu-item>
						</mitra-menu>
					</mitra-popover-container>
				</span>
				<mitra-icon-button icon="settings" label=${t('Settings')} @click=${() => this.settingsClick.dispatch()}></mitra-icon-button>
			</div>
		`
	}

	private getNameTemplate(source: Source) {
		return html`
			<div
				class="name"
				data-rename-id=${source.id}
				title=${`${source.name}\n${t('Double-click to rename')}`}
				contenteditable=${this.renamingId === source.id ? 'plaintext-only' : 'false'}
				@dblclick=${() => this.startRename(source)}
				@keydown=${(e: KeyboardEvent) => this.handleRenameKeydown(e, source)}
				@blur=${(e: Event) => this.commitRename(source, e.target as HTMLElement)}
			>${source.name}</div>
		`
	}

	private getActionsTemplate(integration: Integration, source: Source, index: number, count: number) {
		return html`
			<div class="actions">
				<mitra-popover-container>
					<mitra-icon-button size="small" icon="more-horizontal" label=${t('Calendar options')}></mitra-icon-button>
					<mitra-menu slot="popover">
						<mitra-menu-item icon="pencil" @click=${() => this.startRename(source)}>${t('Rename')}</mitra-menu-item>
						<div class="color-row">
							<mitra-icon icon="palette"></mitra-icon>
							<mitra-color-picker .palette=${Color.palette} .value=${source.color} @change=${(e: CustomEvent) => this.setSourceColor(source, e.detail, (e.currentTarget as HTMLElement).closest('mitra-menu')!)}></mitra-color-picker>
						</div>
						${canRestoreSourceVisibility() ? html`
							<mitra-menu-item icon="eye" @click=${() => this.toggleSolo(source)}>${t('Show previously visible calendars')}</mitra-menu-item>
						` : html`
							<mitra-menu-item icon="scan-eye" ?disabled=${this.isOnlyVisible(source)} @click=${() => this.toggleSolo(source)}>${t('Only show this calendar')}</mitra-menu-item>
						`}
						<mitra-menu-item icon="arrow-up" ?disabled=${index === 0} @click=${() => this.moveSource(integration, source, -1)}>${t('Move up')}</mitra-menu-item>
						<mitra-menu-item icon="arrow-down" ?disabled=${index === count - 1} @click=${() => this.moveSource(integration, source, 1)}>${t('Move down')}</mitra-menu-item>
						${!canCopyEntriesOut(source) ? html.nothing : html`
							<mitra-menu-item icon="folder-input"
								title=${canMoveEntriesOut(source) ? t('Move or copy every entry into another calendar') : t('Copy every entry into another calendar')}
								@click=${() => void new DialogSourceMigration({ source }).confirm().catch(() => void 0)}
							>${canMoveEntriesOut(source) ? t('Move entries to…') : t('Copy entries to…')}</mitra-menu-item>
						`}
						${!integration.reimportable ? html.nothing : html`
							<mitra-menu-item icon="hard-drive-download" title=${t('Read this calendar again from the start')}
								@click=${() => void reimportSource(source.id).catch(() => void 0)}>${t('Re-import entries')}</mitra-menu-item>
						`}
						${!getCapabilities(source.id).deleteSources ? html.nothing : html`
							<mitra-menu-item icon="trash-2" variant="danger" title=${t('Delete this calendar and every entry in it')}
								@click=${() => void this.removeSource(source)}>${t('Delete calendar')}</mitra-menu-item>
						`}
					</mitra-menu>
				</mitra-popover-container>
				<mitra-icon-button size="small"
					class="eye-icon"
					icon=${source.hidden ? 'eye-off' : 'eye'}
					label=${`${source.hidden ? t('Show calendar') : t('Hide calendar')}\n${canRestoreSourceVisibility() ? t('Alt+click to show the previously visible ones') : t('Alt+click to show only this one')}`}
					@click=${(e: MouseEvent) => e.altKey ? this.toggleSolo(source) : this.toggleVisibility(source)}
				></mitra-icon-button>
			</div>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-sidebar': Sidebar
	}
}
