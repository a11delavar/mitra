import { Component, component, html, css, property, state, event, eventListener, unsafeCSS } from '@a11d/lit'
import { getIntegrations, getMeta, getUser, isBundleStale, refreshMetaIfStale, toggleSourceVisibility, updateSourceColor, renameSource, deleteIntegration, fetchIntegrations, getDefaultSourceId, getPrimarySource, setDefaultSource, reimportSource, reimportIntegration, reorderSources, reorderIntegrations, getEnabledSources, getVisibleSources, soloSource, restoreSourceVisibility, canRestoreSourceVisibility } from './Api.js'
import { DialogAbout, hasUnseenChanges } from './DialogAbout.js'
import { DialogIntegration } from './DialogIntegration.js'
import { type Integration, type Source } from 'shared'
import { ReorderabilityController, ReorderabilityState } from '@3mo/reorderability'
import { focusRing } from './components/focusRing.css.js'
import { EntryStore } from './EntryStore.js'
import { Unscheduled } from './Unscheduled.js'
import { canInstall, promptInstall, onInstallAvailabilityChange } from './pwa.js'

@component('mitra-sidebar')
export class Sidebar extends Component {
	@event() readonly openChange!: EventDispatcher<boolean>
	/** A source was hidden or shown — the calendar listens to refetch through its view transition. */
	@event() readonly sourcesChange!: EventDispatcher
	@property({ type: Boolean, reflect: true }) open = false

	/** Tabs rather than stacked sections: each mode wants the column's whole height, and tabs cost
	 * nothing at any width, where a pane beside the calendar would. */
	@state() private tab: 'calendars' | 'planning' = (localStorage.getItem('Mitra.SidebarTab') as 'planning' | null) ?? 'calendars'

	/** Subscribes the sidebar to the store, so the tab's badge follows a task being scheduled or
	 * dropped back with no wiring to `mitra-unscheduled`. */
	readonly store = new EntryStore(this)

	private get unscheduledCount() {
		return this.store.entries.filter(entry => !entry.scheduled).length
	}

	private setTab(tab: 'calendars' | 'planning') {
		this.tab = tab
		localStorage.setItem('Mitra.SidebarTab', tab)
	}

	/**
	 * Drag-to-reorder (@3mo/reorderability), which the ⋯ menus' Move up/down mirror. Grouping is ONE
	 * CONTROLLER PER LIST — a controller only ever sees the items registered with it, so the accounts
	 * reorder among themselves and each account's sources among their own siblings, and a drag can
	 * never carry a row into another account (which is exactly the current feature's promise).
	 *
	 * The `handle` is what disambiguates the two nesting levels: a `.source` sits INSIDE a
	 * `.integration`, so a press on a row is in the path of both controllers' items — the accounts
	 * controller only grabs from the heading's own `.title`, so it stands down for a row (and for the
	 * heading's ⋯ and its menu, which stay plain buttons).
	 */
	private readonly integrationsReorder = new ReorderabilityController(this, {
		handleReorder: (source, destination) => {
			const ids = getIntegrations().map(integration => integration.id)
			this.commitOrder(ids, source, destination, () => reorderIntegrations(ids))
		},
	})

	/** One per account, created on that account's first render. Safe to create late: the controller
	 * registers itself as its own event listener, so it survives being constructed after the host has
	 * connected (a bound-handler field would not — see the package). A disconnected account's
	 * controller is deliberately NOT disposed: its items deregister themselves with the rows lit
	 * drops, so it resolves no item and returns — and an id is a UUID, never handed out twice. */
	private readonly sourcesReorder = new Map<string, ReorderabilityController>()

	private sourcesReorderOf(integration: Integration) {
		let controller = this.sourcesReorder.get(integration.id)
		if (!controller) {
			controller = new ReorderabilityController(this, {
				handleReorder: (source, destination) => {
					const ids = getEnabledSources(integration).map(source => source.id)
					this.commitOrder(ids, source, destination, () => reorderSources(integration, ids))
				},
			})
			this.sourcesReorder.set(integration.id, controller)
		}
		return controller
	}

	/** The one commit path for both the drag and the ⋯ menu: move `ids` and write them wholesale.
	 * Optimistic — the Api reorder functions re-sort the local store before the request — so this
	 * re-renders at once and falls back to the server's truth if the write fails. */
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

	/** A tab left open for days still learns of updates: returning to it re-fetches the meta once its
	 * boot-time copy has aged past the server's own check cadence (see refreshMetaIfStale) — no timers
	 * tick while the tab is hidden. */
	@eventListener({ target: document, type: 'visibilitychange' })
	protected async refreshMeta() {
		if (document.visibilityState === 'visible') {
			await refreshMetaIfStale()
			this.requestUpdate()
		}
	}

	static override get styles() {
		return css`
			/* Animated by the scroll-driven fade below — a custom property only interpolates once it's
			   registered with a type. */
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
				/* Only the three lengths that two distant rules must agree on live here — the source list's
				   columns are laid out by ONE grid the rows subscribe to (see .integrations), not by an
				   arithmetic of per-element paddings. */
				--sidebar-width: 16rem;
				--sidebar-inset: 0.5rem;
				--sidebar-scrollbar-width: 0.5rem;

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
					margin-inline-start: calc(-1 * var(--sidebar-width));
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
					width: var(--sidebar-width);
					height: 100%;
					/* Mixed from the text colour, not --color-surface: surface is LIGHTER than the background
					   in light mode, so that border read as a bevel — or as nothing at all. */
					border-inline-end: 1px solid color-mix(in srgb, var(--color-text) 9%, transparent);
					padding: 1.5rem var(--sidebar-inset) var(--sidebar-inset);
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

					/* Window Controls Overlay (see PageCalendar's header): with the OS title bar gone, the
					   sidebar's dead space becomes the window-drag handle. On macOS the window buttons overlay
					   its top-leading corner, so the first row also drops below the button band — the clamp is
					   the band height where the buttons are actually on the leading side (titlebar-area-x ≈
					   their width) and collapses to 0 on Windows/Linux (x = 0), wasting no space there. */
					@media (display-mode: window-controls-overlay) {
						padding-top: calc(1.5rem + min(env(titlebar-area-x, 0px), env(titlebar-area-height, 0px)));
						-webkit-app-region: drag;

						/* Nothing that SCROLLS may be a drag surface, so the list is carved out of the region
						   wholesale rather than control by control. A drag region hands the pointer to the
						   window manager — the wheel with it — and opting only the controls out left the lane
						   scrolling while over a row and going dead in the 1.5rem between rows: the more
						   integrations you connect, the more of the list stops scrolling, which is the worst
						   possible way for this to scale. What stays draggable is the chrome that cannot
						   scroll — the brand row, the padding around it, the footer — so the sidebar still
						   carries the window, and its top strip still joins the header's into one handle. */
						.integrations {
							-webkit-app-region: no-drag;
						}

						/* A drag region swallows the clicks that land on it, so every control opts back out.
						   The brand row is the deliberate exception — it stays draggable so the logo moves the
						   window; only its version whisper opts out (see .version) to keep About reachable.
						   Kept broader than the chrome outside the lane strictly needs: a popover is in the
						   top layer, so it can paint over ANY drag region (the page header's included), and a
						   no-drag rect there is what keeps its dead space from dragging the window. */
						button:not(.brand), mitra-icon-button, mitra-color-picker, [contenteditable], [popover] {
							-webkit-app-region: no-drag;
						}
					}
				}

				/* Who's signed in, closing the column. */
				.account {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					margin-block-start: 0.5rem;
					padding: 0.75rem 0.25rem 0.25rem;
					border-top: 1px solid color-mix(in srgb, var(--color-text) 9%, transparent);

					/* A provider photo and its absence must occupy the same box, or the name's rail would
					   depend on whether the identity happens to carry a picture. */
					.avatar, .avatar-fallback {
						inline-size: 2rem;
						block-size: 2rem;
						flex-shrink: 0;
						border-radius: 50%;
					}

					.avatar {
						object-fit: cover;
					}

					.avatar-fallback {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						background: color-mix(in srgb, var(--color-text) 8%, transparent);
						color: var(--color-text-muted);
						font-size: 0.9375rem;
					}

					> mitra-icon-button {
						color: var(--color-text-muted);
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
					border-radius: 0.375rem;

					/* The global button skin's hover/active box is far too loud for a brand mark — the only
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

					/* The update badge: a quiet accent dot on the mark's corner — no text, no animation;
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

						/* Dimmed on the text only — the news dot inside must keep its full accent. */
						.label {
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							opacity: 0.7;
						}

						/* The news dot: the instance moved since this user last opened What's New. Quiet by
						   design — no toast, no auto-opened dialog; it goes out when What's New is opened
						   (About → What's New, or the palette command). */
						.news-dot {
							flex-shrink: 0;
							width: 6px;
							height: 6px;
							border-radius: 50%;
							background: var(--color-accent);
						}

						/* Under Window Controls Overlay the brand row drags the window, making this whisper
						   the row's only click-through to About — so it opts out of the drag region and gets
						   a real hit area with a hover affordance. */
						@media (display-mode: window-controls-overlay) {
							-webkit-app-region: no-drag;
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

				   It is also THE grid. One set of columns — marker | name | actions, between two zero-width
				   edge tracks — is declared here, and every account heading and every source row subscribes
				   to it through subgrid. A heading's ⋯ and a row's ⋯ then sit in the same track instead of
				   being talked into the same place by matching paddings. The edge tracks are what inset a
				   row's content from its own hover chip: padding cannot do that job here, because padding on
				   a subgrid item shifts its tracks off the parent's — the very misalignment this prevents.

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
				mitra-tab-panel > mitra-unscheduled {
					flex: 1;
					min-height: 0;
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
					column-gap: 0.5rem;
					row-gap: 1.5rem;
					margin-inline-end: calc(-1 * var(--sidebar-inset));
					padding-inline-end: calc(var(--sidebar-inset) - var(--sidebar-scrollbar-width));
					scrollbar-gutter: stable;
					/* Dissolves the bottom edge while there's more list below, so a row is never sliced flat
					   against the footer. */
					mask-image: linear-gradient(to bottom, #000 calc(100% - var(--sidebar-fade)), transparent);
					animation: sidebar-scroll-fade linear both;
					animation-timeline: scroll(self);
					animation-range: calc(100% - 1.25rem) 100%;

					&::-webkit-scrollbar {
						width: var(--sidebar-scrollbar-width);
					}

					/* No track, and no stepper arrows — the thumb alone. */
					&::-webkit-scrollbar-track {
						background: transparent;
					}

					&::-webkit-scrollbar-button {
						display: none;
					}

					&::-webkit-scrollbar-thumb {
						border-radius: 999px;
						background: color-mix(in srgb, var(--color-text) 12%, transparent);
					}

					&:hover::-webkit-scrollbar-thumb {
						background: color-mix(in srgb, var(--color-text) 26%, transparent);
					}

					/* Firefox has no ::-webkit-scrollbar to size, so it keeps the standard thin thumb — its
					   gutter is then the UA's thin width, a pixel or two off the padding above. */
					@supports not selector(::-webkit-scrollbar-thumb) {
						scrollbar-width: thin;
						scrollbar-color: color-mix(in srgb, var(--color-text) 12%, transparent) transparent;
					}
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
				   [data-reordering] and the grabbed item [data-reorderability=dragging] — the siblings
				   glide aside, the grabbed one rides the pointer raw (its transform is driven per frame).
				   Everything is transforms only, so the subgrid tracks the alignment rests on are never
				   touched; the attributes and transforms clear together on release, and the store's
				   re-sorted render lands in the same task, so the settled order paints exactly once,
				   transition-free — which is why this transition is scoped to the attribute. */
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

					> mitra-icon-button {
						grid-column: 4;
						justify-self: end;
					}
				}

				.source {
					min-height: 1.75rem;
					border-radius: 0.375rem;
					/* The whole row is its own drag handle — a mouse drag must never start a text
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
					   in the row holds focus — tabbing into a transparent button used to park the focus ring
					   on something invisible. */
					&:focus-within .actions mitra-icon-button,
					&:has(menu:popover-open) .actions mitra-icon-button {
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

					/* The leading marker is the shared source icon (see SourceIcon) — the glyph, the colour, the
					   filled state and its geometry all belong to it. This is only what makes it clickable:
					   clicking toggles whether the source is the default for new entries. */
					.marker {
						/* The all: unset comes first — it resets grid-column too, so placing the marker above
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

				/* The grabbed row/block lifts above its gliding siblings on an opaque backing — after the
				   hover rule, so the lift's backing wins over the row's own hover chip while it's carried. */
				.source[data-reorderability=${unsafeCSS(ReorderabilityState.Dragging)}], .integration[data-reorderability=${unsafeCSS(ReorderabilityState.Dragging)}] {
					z-index: 5;
					background-color: var(--color-background);
					border-radius: 0.375rem;
					box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.25);
					cursor: grabbing;
				}

				/* Every glyph the sidebar's own buttons carry is one size. */
				mitra-icon-button {
					font-size: 0.875rem;
				}

				/* An icon button's glyph sits 5px inside its own box (0.25rem padding + 1px border); the
				   trailing ones bleed that back out, so it is the GLYPHS that land on the trailing edge —
				   aligning the boxes instead leaves every icon a few pixels short of the text above it. */
				.integration > header > mitra-icon-button, .actions, .account > mitra-icon-button {
					margin-inline-end: -0.3125rem;
				}

				/* Pinned below the scroll region — always visible, however long the source list grows. */
				.footer {
					flex-shrink: 0;
					display: flex;
					flex-direction: column;
					gap: 0.375rem;
				}

				/* Sized to a source row rather than to its own padding, which is where the footer's height
				   went: two of these plus a 1rem gap used to cost as much as three source rows. */
				.action {
					color: var(--color-text-muted);
					background: transparent;
					mitra-icon { font-size: 0.875rem; }
				}

				/* Both menus in here open off the sidebar's inline end — a 280px column has no room to drop
				   one below its trigger — and both wear the app's shared menu skin (see menu.css), which the
				   source menu used to re-implement at slightly different paddings, radii and shadow: two
				   visibly different menus hanging off two ⋯ buttons a row apart. */
				menu[popover] {
					margin: 0;
					position-area: inline-end span-block-end;
					position-try-fallbacks: flip-block;

					/* The colour picker is the one menu row that isn't a button; match the shared skin's. */
					.color-row {
						display: flex;
						align-items: center;
						gap: 0.5rem;
						padding: 0.4rem 0.625rem;

						> mitra-icon {
							font-size: 15px;
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
		this.visibilityChanged()
	}

	/**
	 * "Only show this calendar" and its way back, as one gesture — the Alt+click and the ⋯ item both
	 * land here. Leave a solo if there is one, enter one otherwise; which row asked doesn't matter,
	 * since a solo is a state of the whole list.
	 *
	 * Hiding or showing a calendar by hand meanwhile does NOT spend the record — the way back stays
	 * parked until it's used.
	 */
	private async toggleSolo(source: Source) {
		await (canRestoreSourceVisibility() ? restoreSourceVisibility() : soloSource(source.id))
		this.visibilityChanged()
	}

	/** Re-render the rows, and let the page refetch through its transition (see PageCalendar). */
	private visibilityChanged() {
		this.requestUpdate()
		this.sourcesChange.dispatch()
	}

	/** Nothing to solo down to when this row is already all that's on show. */
	private isOnlyVisible(source: Source) {
		const visible = getVisibleSources()
		return visible.length === 1 && visible[0]?.id === source.id
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

	/** Whether this is the source a new entry will actually land in — asked of the same function the
	 * create paths ask (getPrimarySource), not re-derived from the stored preference. There often ISN'T
	 * one stored: the default then falls back to the first visible source, and a stored default that has
	 * since been hidden falls back the same way. Reading `defaultSourceId` alone left the marker silent
	 * in the first case and lit on a hidden row that creates no longer target in the second. */
	private isDefault(source: Source) {
		return getPrimarySource()?.id === source.id
	}

	/** What the marker promises, worded for the three states it can actually be in — a lit marker that
	 * holds the default only by fallback must not offer to unset something that was never set. */
	private defaultHint(source: Source) {
		if (!this.isDefault(source)) {
			return t('Set as the default for new entries')
		}
		return getDefaultSourceId() === source.id
			? t('Default for new entries — click to unset')
			: t('Default for new entries, as the first one shown')
	}

	/** Only a STORED preference can be cleared: clicking the source that already holds the default by
	 * fallback has nothing to undo (clearing it would re-elect the same row), so it stands down rather
	 * than round-tripping to the server for no visible change. */
	private async toggleDefault(source: Source) {
		const stored = getDefaultSourceId() === source.id
		if (this.isDefault(source) && !stored) {
			return
		}
		await setDefaultSource(stored ? undefined : source.id)
		this.requestUpdate()
	}

	private closeMenu(e: Event) {
		(e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover()
	}

	private toggleMenu(e: Event) {
		(e.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>('menu[popover]')?.togglePopover()
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

	/** Shift a source one slot within its integration — the ⋯ menu's keyboard/touch-reachable twin of
	 * the drag, committing through the very same path. Reordering is what elects the fallback default
	 * ("the first one shown"), so moving a source to the top doubles as picking the default when none
	 * is stored. */
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

	/** What the brand row admits about the build: a bare `dev` when the build is main past the last tag
	 * (the rolling `dev` image — and a git-less local fallback), otherwise the version as it is — the
	 * tag on a release, the whole describe string for anything murkier: dirty trees, pre-release tags,
	 * tagless clones. */
	private get versionLabel() {
		return mitra.version === 'dev' || /^v\d.*-\d+-g[0-9a-f]+$/.test(mitra.version) ? 'dev' : mitra.version
	}

	/** What the dot on the brand mark means right now, worded for the row's title. The stale-tab case
	 * wins over a pending server-side update: a reload delivers it in one click — and usually clears
	 * the other signal along the way. */
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
							<span class="title">${i.credentials?.username || i.type}</span>
							<mitra-icon-button icon="more-horizontal" label=${t('Integration options')} style="anchor-name: --anchor-${i.id}" @click=${this.toggleMenu}></mitra-icon-button>
							<menu popover id="menu-${i.id}" style="position-anchor: --anchor-${i.id}">
								<button @click=${(e: Event) => { this.closeMenu(e); this.openDialog(i.id) }}>
									<mitra-icon icon="pencil"></mitra-icon>
									${t('Edit')}
								</button>
								${/* The drag reorder's accessible, discoverable twin (see SidebarReorderController). */''}
								<button ?disabled=${index === 0} @click=${(e: Event) => { this.closeMenu(e); this.moveIntegration(i.id, -1) }}>
									<mitra-icon icon="arrow-up"></mitra-icon>
									${t('Move up')}
								</button>
								<button ?disabled=${index === integrations.length - 1} @click=${(e: Event) => { this.closeMenu(e); this.moveIntegration(i.id, 1) }}>
									<mitra-icon icon="arrow-down"></mitra-icon>
									${t('Move down')}
								</button>
								${/* Re-import only — there is deliberately no "sync now" here: syncing runs itself,
								   and offering to trigger it would imply what's on screen might be stale. */''}
								<button
									title=${t('Delete the locally cached entries of every enabled source and import everything again')}
									@click=${(e: Event) => { this.closeMenu(e); reimportIntegration(i.id).catch(() => void 0) }}>
									<mitra-icon icon="hard-drive-download"></mitra-icon>
									${t('Re-import entries')}
								</button>
								<button class="danger" @click=${(e: Event) => { this.closeMenu(e); this.removeIntegration(i.id) }}>
									<mitra-icon icon="trash-2"></mitra-icon>
									${t('Delete')}
								</button>
							</menu>
						</header>
						<div class="sources">
							${getEnabledSources(i).map((source, sourceIndex, sources) => html`
								<div class="source" ${this.sourcesReorderOf(i).item({ index: sourceIndex })} ?data-hidden=${source.hidden}>
									${/* The shared source icon (see SourceIcon), filled here for the source new entries
									    land in — which is what clicking it toggles. */''}
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
			${/* Belongs to THIS mode, not to the column: adding an account says nothing in Planning. */''}
			<button class="action" @click=${() => this.openDialog()}>
				<mitra-icon icon="plus"></mitra-icon>
				${t('Add Integration')}
			</button>
		`
	}

	/** The button is this mode's primary verb, in the same shape and place Calendars puts "Add
	 * Integration" — jotting a task down is a central act, not a glyph tucked into a heading. */
	private get planningTemplate() {
		return html`
			<mitra-unscheduled></mitra-unscheduled>
			${!Unscheduled.canAdd ? html.nothing : html`
				<button class="action" @click=${() => Unscheduled.add()}>
					<mitra-icon icon="plus"></mitra-icon>
					${t('Add Task')}
				</button>
			`}
		`
	}

	protected override get template() {
		return html`
			<div class="backdrop" ?data-open=${this.open} @click=${() => this.openChange.dispatch(false)}></div>
			<nav ?data-open=${this.open}>
				<button class="brand" title=${[`Mitra ${mitra.version}`, this.updateHint].filter(Boolean).join(' — ')} @click=${() => new DialogAbout().confirm()}>
					<span class="mark">
						<img src="/android-chrome-192x192.png" alt="">
						${!this.updateHint ? '' : html`<span class="dot"></span>`}
					</span>
					<span class="name">${getMeta()?.name ?? 'Mitra'}</span>
					<span class="version">
						<span class="label">${this.versionLabel}</span>
						${this.updateHint || !hasUnseenChanges() ? html.nothing : html`<span class="news-dot" title=${t('What\'s New')}></span>`}
					</span>
				</button>
				${/* The column's two modes. Rendered as a tablist so the roles say what the shape says. */''}
				<mitra-tabs .selected=${this.tab} @selectedChange=${(e: CustomEvent<string>) => this.setTab(e.detail as 'calendars' | 'planning')}>
					<mitra-tab name="calendars" icon="calendar-days">${t('Calendars')}</mitra-tab>
					<mitra-tab-panel name="calendars">${this.calendarsTemplate}</mitra-tab-panel>

					${/* The one thing a tab costs is not seeing the other list — so the number comes along. */''}
					<mitra-tab name="planning" icon="list-todo" .badge=${this.unscheduledCount}>${t('Planning')}</mitra-tab>
					<mitra-tab-panel name="planning">${this.planningTemplate}</mitra-tab-panel>
				</mitra-tabs>
				${/* What is left here is app-level and true in either mode. */''}
				<div class="footer">
					${!canInstall() ? html.nothing : html`
						<button class="action"
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
				${identity.picture && !this.profilePictureBroken ? html`
					<img class="avatar" src=${identity.picture} alt="" referrerpolicy="no-referrer" @error=${() => this.profilePictureBroken = true}>
				` : html`
					<span class="avatar-fallback">
						<mitra-icon icon="user"></mitra-icon>
					</span>
				`}
				<div class="who">
					<div class="name">${identity.name || identity.email || t('Account')}</div>
					${!identity.email || identity.email === identity.name ? html.nothing : html`<div class="email">${identity.email}</div>`}
				</div>
				<mitra-icon-button icon="log-out" label=${t('Sign out')}
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

	private getActionsTemplate(integration: Integration, source: Source, index: number, count: number) {
		return html`
			${/* The ⋯ leads and the eye trails, against convention: the eye is the one that stays on show for
			    a hidden source, and only in the last slot does it sit on the trailing edge rather than floating
			    in the gap the (invisible) ⋯ would have filled. The menu anchors to the whole group rather than
			    to its own trigger, so it opens clear of the eye now sitting beside it. */''}
			<div class="actions" style="anchor-name: --source-menu-${source.id}">
				<mitra-icon-button
					icon="more-horizontal"
					label=${t('Calendar options')}
					@click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement)?.togglePopover()}
				></mitra-icon-button>
				<menu popover id="source-menu-${source.id}" style="position-anchor: --source-menu-${source.id}">
					<button @click=${() => this.startRename(source)}>
						<mitra-icon icon="pencil"></mitra-icon>
						${t('Rename')}
					</button>
					<div class="color-row">
						<mitra-icon icon="palette"></mitra-icon>
						<mitra-color-picker .value=${source.color} @change=${(e: CustomEvent) => this.setSourceColor(source, e.detail, (e.currentTarget as HTMLElement).closest('[popover]')!)}></mitra-color-picker>
					</div>
					${/* The Alt+click gesture's reachable twin, as Move up/down is the drag's. One item rather
					    than two — there is only ever one solo, so the state decides which way it points. */''}
					${canRestoreSourceVisibility() ? html`
						<button @click=${(e: Event) => { this.closeMenu(e); this.toggleSolo(source) }}>
							<mitra-icon icon="eye"></mitra-icon>
							${t('Show previously visible calendars')}
						</button>
					` : html`
						<button ?disabled=${this.isOnlyVisible(source)} @click=${(e: Event) => { this.closeMenu(e); this.toggleSolo(source) }}>
							<mitra-icon icon="scan-eye"></mitra-icon>
							${t('Only show this calendar')}
						</button>
					`}
					${/* The drag reorder's accessible, discoverable twin (see SidebarReorderController). */''}
					<button ?disabled=${index === 0} @click=${(e: Event) => { this.closeMenu(e); this.moveSource(integration, source, -1) }}>
						<mitra-icon icon="arrow-up"></mitra-icon>
						${t('Move up')}
					</button>
					<button ?disabled=${index === count - 1} @click=${(e: Event) => { this.closeMenu(e); this.moveSource(integration, source, 1) }}>
						<mitra-icon icon="arrow-down"></mitra-icon>
						${t('Move down')}
					</button>
					<button
						title=${t('Delete the locally cached entries and import everything from the source again')}
						@click=${(e: Event) => { this.closeMenu(e); reimportSource(source.id).catch(() => void 0) }}>
						<mitra-icon icon="hard-drive-download"></mitra-icon>
						${t('Re-import entries')}
					</button>
				</menu>
				${/* Alt+click solos and un-solos, the way Alt+drag duplicates. Named in the tooltip rather
				    than left to be found, like the name row's "Double-click to rename". */''}
				<mitra-icon-button
					class="eye-icon"
					icon=${source.hidden ? 'eye-off' : 'eye'}
					label=${`${source.hidden ? t('Show calendar') : t('Hide calendar')} — ${canRestoreSourceVisibility() ? t('Alt+click to show the previously visible ones') : t('Alt+click to show only this one')}`}
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
