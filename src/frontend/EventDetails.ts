import { component, html, property, state, Component, css, eventListener, event, Binder, query } from '@a11d/lit'
import { EntryType, TaskStatus, type Integration, type RecurrenceScope } from 'shared'
import type { EntrySegment } from './EntrySegment.js'
import { getIntegrations, getSource, getCapabilities } from './Api.js'
import { EntryStore } from './EntryStore.js'
import { closeSheet } from './components/sheet.js'

@component('mitra-entry-details')
export class EntryDetailsComponent extends Component {
	@event() readonly openChange!: EventDispatcher<boolean>
	@property({
		type: Boolean,
		updated(this: EntryDetailsComponent) {
			// Reconcile the native popover to `open` on the next frame — never synchronously here — for two
			// reasons that both otherwise close the popover the instant it opens:
			//   1. Tap-to-open ends with a trusted `click` that (since Chromium 135) is delivered to the grid
			//      container holding pointer capture — i.e. OUTSIDE this popover. Showing synchronously lets
			//      the (experimental, soon-to-ship) click-based popover light-dismiss use that click to close
			//      us the instant we opened, so a real click reads as "nothing happens".
			//   2. `handleBeforeToggle` mirrors browser-driven toggles back into `open` (through the two-way
			//      bind + `openChange`); calling show/hidePopover from inside that `beforetoggle` dispatch is
			//      the re-entrancy the platform warns about ("beforetoggle … triggered another popover to be
			//      shown").
			// Deferring past the current task, then reconciling against the popover's real state, avoids both.
			requestAnimationFrame(() => {
				if (!this.isConnected) {
					return
				}
				const isOpen = this.matches(':popover-open')
				if (this.open && !isOpen) {
					this.showPopover()
				} else if (!this.open && isOpen) {
					this.hidePopover()
				}
			})
		}
	}) open = false

	@property({ type: Object }) segment?: EntrySegment

	// Subscribe to the store: external changes adopted onto the open entry re-render the popover too.
	// (Adoption only happens while the entry is clean, so a re-render can't fight in-progress typing.)
	readonly store = new EntryStore(this)

	private get source() {
		return this.segment?.entry.sourceId ? getSource(this.segment.entry.sourceId) : undefined
	}

	/** What the entry's provider can hold — fields it can't are hidden, not silently dropped. */
	private get capabilities() {
		return getCapabilities(this.segment!.entry.sourceId)
	}

	protected override createRenderRoot() { return this }

	@query('.title') private readonly titleInput?: HTMLInputElement
	@query('.description textarea') private readonly descriptionTextarea?: HTMLTextAreaElement

	@eventListener('beforetoggle')
	handleBeforeToggle(e: ToggleEvent) {
		this.open = e.newState === 'open'
		this.openChange.dispatch(this.open)
	}

	@eventListener('toggle')
	protected handleToggle(e: ToggleEvent) {
		if (e.newState === 'open') {
			// Only grab focus for a fresh, untitled entry (e.g. a just-dropped draft); don't steal it when
			// reopening one that already has a title.
			if (!this.segment?.entry.heading?.trim()) {
				requestAnimationFrame(() => this.titleInput?.focus())
			}
		}
	}

	// The binder mutated the entry in place; committing it (and everything else — coalescing, the
	// create/update sequencing, adopting the response) is the store's concern, not this component's.
	private readonly handleChange = () => {
		return EntryStore.commit(this.segment!.entry)
	}

	// A failed save must not go down silently: the entry stays dirty (the commit loop retries on the
	// next change), but the user deserves at least a console trace of WHY their edit didn't stick.
	private readonly reportSaveError = (error: unknown) => {
		console.error('Persisting the entry failed — the edit is kept locally and retried on the next change:', error)
	}

	// The task checkbox/menu mutated `entry.status`: render it everywhere this frame, then persist.
	private readonly handleStatusChange = () => {
		EntryStore.notify()
		this.handleChange().catch(this.reportSaveError)
	}

	// The <mitra-entry-details-when> editor mutated the entry's span in place: render, then persist.
	private readonly handleWhenChange = () => {
		EntryStore.notify()
		this.handleChange().catch(this.reportSaveError)
	}

	// A failed delete reinstates the entry in the store (see EntryStore.delete) — so unlike a save,
	// the user SEES the failure; the console then carries the server's reason. A preset scope (the
	// Ctrl chord/click below) skips the recurrence dialog and deletes this occurrence alone.
	private readonly handleDelete = (scope?: RecurrenceScope) => {
		const entry = this.segment!.entry
		this.hidePopover()
		return EntryStore.delete(entry, scope).catch(error =>
			console.error('Deleting the entry failed — it was restored in the view:', error))
	}

	/** The scope a modifier chord presets: Ctrl (⌘ on a Mac) means "this entry only, don't ask" — on a
	 * non-recurring entry it's simply ignored downstream. Alt is the duplicate modifier, never a scope. */
	private static presetScope(e: MouseEvent | KeyboardEvent): RecurrenceScope | undefined {
		return e.ctrlKey || e.metaKey ? 'this' : undefined
	}

	/** Duplicate this entry — the pointer twin of Alt-drag, for when you're already in the editor. With
	 * no drop position to place it, the copy takes this entry's own slot and opens for editing (a
	 * duplicate exists to be changed, and it sits right on top of its original until it is). A series
	 * occurrence copies into a single standalone entry, like the gesture — see EntryStore.duplicate. */
	private readonly handleDuplicate = () => {
		const entry = this.segment!.entry
		this.hidePopover()
		return EntryStore.duplicate(entry)
			.then(copy => EntryStore.requestOpen(copy.id!))
			.catch(error => console.error('Duplicating the entry failed — nothing was added:', error))
	}

	/** Apple keyboards have no forward-delete key: their ⌫ "delete" reports `Backspace` (⌦ only exists
	 * on full-size boards, or as fn+⌫) — so the menu's hint shows the glyph Mac users actually press. */
	private static readonly appleKeyboard = /Mac|iPhone|iPad/.test(navigator.platform)

	/** Alt as the board prints it — ⌥ on Apple's, like the cheat sheet's own label. */
	private static get altKey() { return EntryDetailsComponent.appleKeyboard ? '⌥' : 'Alt' }

	// Delete (and Backspace — the only "delete" an Apple keyboard has, and what Apple Calendar itself
	// uses) deletes the entry while its editor is open: the keyboard twin of the menu's Delete button.
	// With Ctrl (⌘) held it presets the scope: a series occurrence deletes alone, no dialog. Guarded
	// like PageCalendar's view shortcuts: a keystroke inside a text field (title, description, the
	// source select…), an Alt chord, or an IME composition is theirs, not ours.
	@eventListener({ target: window, type: 'keydown' })
	protected handleWindowKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Delete' && e.key !== 'Backspace') {
			return
		}
		const target = e.target
		const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
			|| target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
		if (!this.open || editable || e.altKey || e.isComposing) {
			return
		}
		e.preventDefault()
		this.handleDelete(EntryDetailsComponent.presetScope(e))
	}

	// As a bottom sheet this slides out rather than vanishing; closeSheet reports when it took over
	// (and hides the popover itself once the slide lands), leaving the anchored popover to close flat.
	private readonly handleClose = (e: Event) => {
		e.stopPropagation()
		if (!closeSheet(this)) {
			this.hidePopover()
		}
	}

	private readonly toggleMenu = (e: Event) => {
		(e.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>('menu[popover]')?.togglePopover()
	}

	private readonly binder = new Binder(this, 'segment')

	private bind = (keyPath: KeyPath.Of<EntrySegment>, event = 'change') => {
		return this.binder.bind({ keyPath, event, sourceUpdated: () => EntryStore.notify() })
	}

	static override get styles() {
		return css`
			/* Block-direction placements for anchors too wide to sit beside: a multi-day all-day bar
			   can span the whole week, so no window is wide enough to fit the popover on either inline
			   side of it — without these it fell straight through to the bottom sheet on a full-size
			   desktop. Inset-based rather than 'position-area: block-end span-all' on purpose: the
			   position-area grid tracks follow the ANCHOR, and the week strip keeps buffer days in the
			   DOM, so a wide segment's grid — and with it the containing block that fallbacks are
			   overflow-tested against — reaches past the viewport, and the popover got parked partly
			   off-screen (verified). Zero inline insets pin that containing block to the real viewport
			   instead; anchor-center then centres on the anchor but shifts as far as needed to stay
			   inside it. */
			@position-try --below {
				position-area: none;
				inset-block: calc(anchor(end) + 0.25rem) auto;
				inset-inline: 0;
				justify-self: anchor-center;
			}

			@position-try --above {
				position-area: none;
				inset-block: auto calc(anchor(start) + 0.25rem);
				inset-inline: 0;
				justify-self: anchor-center;
			}

			mitra-entry-details {
				/* Closed means GONE, which needs saying explicitly: an author display declaration beats
				   the UA rule that hides a non-open popover no matter how weak the selector, and this
				   element sits in the DOM while still closed for one frame every single time it opens
				   (lit renders it, then EntryDetailsComponent defers showPopover by a frame — see the
				   note there). The old value was "contents", which generates no box for the host but
				   still lays its CHILD out in the page flow; harmless while the host carried the
				   visuals, but now that the sheet contract moved surface, radius and shadow onto that
				   child it flashed a stray glass panel into the calendar on every open. */
				display: none;
				cursor: default;

				/* The entry's colour tints the toggle switch, the pickers' chosen rows and the text
				   selection — inherited from the segment this editor renders inside, which declares it for
				   every surface the entry opens (see EntrySegment), not just for this one. */
				& ::selection {
					background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 40%, transparent);
				}

				&:popover-open {
					display: flex;
					flex-direction: column;
				}

				border: none;
				margin: 0;
				outline: none;
				padding: 0;

				/* The sheet contract's frame properties (see components/sheet.ts): the editor's outer
				   shape and its depth belong to the FRAME, because the frame's scroll-container clip
				   crops anything the list paints outside its own border box — which is every pixel of
				   a drop shadow, and the corners. The list keeps a matching radius of its own so its
				   border and glass are shaped too (sheet mode replaces that with top-only rounding). */
				--sheet-frame-radius: 0.5rem;
				--sheet-frame-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);

				position: fixed;
				margin-inline: 0.25rem;
				position-area: inline-end span-all;
				position-visibility: anchors-visible;
				/* The ladder: beside the anchor (right, then left — flip-block is pointless here, the
				   block axis is already span-all), then below/above it for anchors too wide to have a
				   beside (see the @position-try rules), and --sheet (see components/sheet.ts) as the
				   terminal fallback: pinned to the viewport it always fits, so the popover becomes a
				   draggable bottom sheet exactly when every anchored placement above overflowed. The
				   former 'position-try-order: most-block-size' had to go for it: ordered by block
				   size, the viewport-tall sheet would sort to the front and win everywhere. */
				position-try-fallbacks: flip-inline, --sheet;

				/* The below/above rungs exist only where a floating popover has breathing room. On a
				   phone they would often FIT (any entry with a viewport-height of space under it), and
				   every placement that fits wins over the sheet — so listing them unconditionally
				   trades the consistent sheet-on-mobile experience for a popover lottery decided by
				   scroll position. The sheet itself stays fallback-triggered, not breakpointed: a
				   desktop window squeezed too tight for every rung still gets it. */
				@media (width >= 40rem) {
					position-try-fallbacks: flip-inline, --below, --above, --sheet;
				}

				/* Wide enough for the times row to carry the inline zone chip ("GMT+3:30") next to the
				   end time without cramping the inputs. */
				width: 360px;
				max-height: 80dvh;

				color: var(--color-text);
				font-family: 'Inter', sans-serif;
				font-size: 0.75rem;

				&::backdrop {
					background: transparent;
				}

				> ul {
					list-style: none;
					margin: 0;
					padding: 0.5rem 1rem 0.75rem;

					/* The popover itself is the sheet contract's transparent frame (see components/sheet.ts):
					   the list is its single child and carries ALL the chrome — in anchored mode too, where
					   it also caps itself (inherit = the frame's 80dvh) and scrolls inside, so the border and
					   radius no longer scroll away with long content. */
					max-height: inherit;
					overflow-y: auto;
					background: var(--mitra-entry-surface);
					backdrop-filter: blur(10px);
					border: var(--border);
					border-radius: var(--sheet-frame-radius);
					display: grid;
					/* Just two columns for the whole popover: a leading glyph (icon / checkbox / switch /
					   colour-square) and its content. Every row subgrids it so the glyphs line up. The
					   date/time editor does its own start/→/end alignment within the content column. */
					grid-template-columns: auto minmax(0, 1fr);
					/* Rows size to their content and NOTHING may talk them out of it. A row left at the
					   default auto keeps an auto maximum, which a capped grid is free to clamp once the
					   list outgrows its 80dvh: the tallest row (a long participant list) was squeezed by
					   exactly the overflow while its content kept its real height, so the add box ended up
					   drawn over "Description". The cap has to produce a SCROLL, never a shorter row. */
					grid-auto-rows: min-content;
					/* The field boxes carry the vertical air now — the gap only separates their borders. */
					row-gap: 0.125rem;
					column-gap: 0.5rem;

					> hr {
						margin: 0.5rem 0;
						background: rgba(255, 255, 255, 0.06);
						width: 100%;
						height: 1px;
						outline: none;
						border: none;
						grid-column: -1 / 1;
					}

					> li {
						display: grid;
						grid-template-columns: subgrid;
						grid-column: 1 / -1;
						align-items: center;

						> mitra-icon {
							font-size: 0.87rem;
							color: var(--color-text-muted);
							flex-shrink: 0;
						}

						/* A field row IS the field (see field.css.ts): the box reaches half a rem beyond
						   the columns on both sides — the net-zero margin/padding pair keeps the grid
						   alignment — so the hover border wraps the glyph and the content as ONE control. */
						&.field {
							margin-inline: -0.5rem;
						}

						> .content {
							grid-column: 2 / -1;
							display: flex;
							align-items: center;
							flex-wrap: wrap;
							opacity: 0.85;
						}

						/* Title row: the task checkbox sits in the gutter (lined up with the icons below); the
						   title + the options/close controls fill the content columns — or the whole row when
						   there's no checkbox (events). */
						&.title-row {
							> mitra-task-status { font-size: 0.95rem; }

							> .title-bar {
								grid-column: 2 / -1;
								display: flex;
								align-items: center;
								gap: 0.25rem;

								> .title {
									flex: 1;
									/* The title is a field of its own (the checkbox/options stay outside its
									   box); the leading net-zero pair keeps its text on the popover's rhythm
									   line while the border reaches out like every other field's. */
									margin-inline-start: -0.5rem;
									font-size: 0.9375rem;
									font-weight: 600;
									color: var(--color-text);
									line-height: 1.3;

									&[data-struck] {
										text-decoration: line-through;
										color: var(--color-text-muted);
									}
								}
							}

							&:not(:has(mitra-task-status)) > .title-bar { grid-column: 1 / -1; }
						}

						&.description {
							/* The same box and metrics for BOTH faces of the field (the editing textarea
							   and the rendered markdown), so toggling between them never shifts the layout. */
							> textarea, > .rendered {
								grid-column: 2 / -1;
								width: 100%;
							}

							> .rendered {
								cursor: text;
								padding-block: calc((var(--control-height) - 2px - 1lh) / 2);

								mitra-markdown {
									line-height: inherit;
								}
							}

							}

						&.source {
							/* The icon sits in the gutter over the select, which spans the whole row: it must not
							   swallow the clicks that open the picker. Sized to the gutter's other glyphs — the
							   clock, the globe, the palette — rather than to the roomier option list's. */
							> mitra-source-icon {
								grid-area: 1 / 1;
								pointer-events: none;
								font-size: 0.875rem;
							}

							/* The whole row is one select: it reads as plain text — the selected option's
							   own dot/type/name via <selectedcontent> — and the row's field box carries
							   the hover/active feedback. */
							> select {
								display: grid;
								grid-template-columns: subgrid;
								/* Row 1 explicitly: the mark above shares the gutter cell with it, and two
								   auto-placed items both wanting column 1 would land on separate lines. */
								grid-row: 1;
								grid-column: -1 / 1;

								/* The picker wears the popover's tinted glass, border, and shadow (it inherits the
								   segment colour var), so the two read as one plane. It prefers opening beside
								   the row and flips inline/block when the space runs out — the same strategy as
								   the details popover itself. */
								&::picker(select) {
									background: var(--mitra-entry-surface);
									border: var(--border);
									box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48),0px 4px 12px -1px rgba(0,0,0,0.24);
									position-area: inline-end span-all;
									position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
									margin-inline: 0.875rem;
								}

								&::picker-icon {
									grid-row: 1;
									grid-column: -1;
								}

								/* Only the name: it sits in the content column, so the closed picker reads as plain
								   text on the same rails as every other row. The icon it also cloned out of the
								   chosen option is dropped — the row draws its own (see the template). */
								selectedcontent {
									grid-column: 2;
									align-items: center;

									mitra-source-icon {
										display: none;
									}
								}

								optgroup > legend {
									font-size: 0.6875rem;
									font-weight: 600;
									color: var(--color-text-muted);
									padding: 0.375rem 0.625rem 0.125rem;
								}

								option {
									gap: 0.5rem;
									.name { flex: 1; }
								}
							}
						}

						&.color {
							.content {
								gap: 0.375rem;
							}
						}

					}

				}

				/* Sheet mode — the --sheet fallback landed (see components/sheet.ts for the mechanics). */
				@container anchored(fallback: --sheet) {
					& > ul {
						/* The home-indicator region on gesture phones must not clip the last row. */
						padding-block-end: max(1rem, env(safe-area-inset-bottom));

						/* The shared grab handle is the list's ::before, which grid auto-placement would drop
						   into the icon gutter — span it across the editor's rows so it centres on the sheet. */
						&::before {
							grid-column: 1 / -1;
						}
					}
				}
			}
		`
	}

	protected override get template() {
		return !this.segment ? html.nothing : html`
			<ul>
				<li class="title-row">
					${this.segment.entry.type !== EntryType.Task ? html.nothing : html`
						<mitra-task-status .entry=${this.segment.entry} @change=${this.handleStatusChange}></mitra-task-status>
					`}
					<div class="title-bar">
						<input class="title field" placeholder=${t('Title')}
							?data-struck=${this.segment.entry.status === TaskStatus.Done || this.segment.entry.status === TaskStatus.Cancelled}
							${this.bind('entry.heading', 'input')} @change=${this.handleChange}>
						<mitra-icon-button
							label=${t('Options')}
							icon="more-horizontal"
							style="anchor-name: --entry-menu-${this.segment.entry.id}; color: var(--color-text-muted)"
							@click=${this.toggleMenu}
						></mitra-icon-button>
						<menu popover id="entry-menu-${this.segment.entry.id}" style="position-anchor: --entry-menu-${this.segment.entry.id}">
							${/* The pointer twin of Alt-drag (see EntryDragController), which is what the hint
							    advertises: no drop position here, so the copy lands on this entry's own slot and
							    opens for editing — the change you duplicated it to make comes next. Offered on a
							    saved entry only, the same bar the gesture sets: a draft is not yet a thing to
							    copy, and duplicating one would persist the copy while the original stayed local. */''}
							${!this.segment.entry.persisted ? html.nothing : html`
								<button @click=${this.handleDuplicate}>
									<mitra-icon icon="copy"></mitra-icon>
									${t('Duplicate')}
									<kbd>${EntryDetailsComponent.altKey}</kbd>
									<span class="word">${t('drag')}</span>
								</button>
							`}
							<button class="danger" @click=${(e: MouseEvent) => this.handleDelete(EntryDetailsComponent.presetScope(e))}>
								<mitra-icon icon="trash-2"></mitra-icon>
								${t('Delete')}
								<kbd>${EntryDetailsComponent.appleKeyboard ? '⌫' : 'Del'}</kbd>
							</button>
						</menu>
						<mitra-icon-button class="close" icon="x" label=${t('Close')}
							style="color: var(--color-text-muted)"
							@click=${this.handleClose}
						></mitra-icon-button>
					</div>
				</li>
				${!this.segment.entry.start ? html.nothing : html`
					<mitra-entry-details-when .entry=${this.segment.entry} @change=${this.handleWhenChange}></mitra-entry-details-when>
					<hr>
				`}
				${!this.capabilities.location && !this.capabilities.description && !this.capabilities.participants ? html.nothing : html`
					${this.locationTemplate}
					${this.participantsTemplate}
					${this.descriptionTemplate}
					<hr>
				`}
				${this.sourceTemplate}
				${this.colorTemplate}
				${this.remindersTemplate}
			</ul>
		`
	}

	private get sourceTemplate() {
		// Migrate the entry to the picked source: its shape follows the target (see Entry.migrateTo) and
		// the usual commit persists it — the backend re-creates it over there and the store adopts the
		// re-created identity from the response. A draft simply changes what it will be created in.
		const handleSourceChange = (e: Event) => {
			const sourceId = (e.target as HTMLSelectElement).value
			const source = getIntegrations().flatMap(integration => [...integration.sources]).find(source => source.id === sourceId)
			const entry = this.segment!.entry
			if (!source || source.id === entry.sourceId) {
				return
			}
			entry.migrateTo(source)
			EntryStore.notify()
			this.handleChange().catch(this.reportSaveError)
		}
		const entry = this.segment!.entry
		// Whether a target integration can hold this entry's current content — the same capabilities that
		// hide editor fields also decide where an entry may move. Offering an impossible target would
		// collapse a series' rule or drop a Cancelled status (the backend rejects both), so it's excluded
		// rather than shown and left to fail. The entry's own source is always kept (it's the selection).
		const canHold = (integration: Integration) => {
			const capabilities = integration.capabilities ?? { recurrence: true, cancelledStatus: true }
			return (!entry.partOfSeries || capabilities.recurrence)
				&& (entry.status !== TaskStatus.Cancelled || capabilities.cancelledStatus)
		}
		return !this.source?.name ? html.nothing : html`
			<li class="source field">
				${/* The row's own icon, in the icon gutter with the clock, globe and palette — the source's
				    kind in the source's colour, which is also where the popover gets its own tint from. It is
				    rendered HERE rather than left to <selectedcontent> below: that draws the chosen option by
				    cloning it, and the clone (carrying no properties, and taken before the icon has even
				    rendered once) would always come out a colourless calendar. */''}
				<mitra-source-icon .source=${this.source}></mitra-source-icon>
				<select @change=${handleSourceChange}>
					<button>
						<selectedcontent></selectedcontent>
					</button>
					${getIntegrations().map(integration => {
						const sources = [...integration.sources].filter(source =>
							source.id === entry.sourceId || (source.visible && canHold(integration)))
						return !sources.length ? html.nothing : html`
							<optgroup label=${integration.credentials?.username || integration.type}>
								<legend>${integration.credentials?.username || integration.type}</legend>
								${/* The shared source icon (see SourceIcon) — one coloured kind glyph, never filled
								    here: the picker already says which option is the current one. It sits in the
								    row's icon gutter, on the same rail as the clock, globe and palette above. */''}
								${sources.map(source => html`
									<option value=${source.id} ?selected=${source.id === entry.sourceId}>
										<mitra-source-icon .source=${source}></mitra-source-icon>
										<span class="name">${source.name}</span>
									</option>
								`)}
							</optgroup>
						`
					})}
				</select>
			</li>
		`
	}

	private get locationTemplate() {
		// The field mutates `entry.location` in place; both its typed commits (the input's bubbling
		// `change`) and picked suggestions (the component's own `change`) land here and persist.
		return !this.capabilities.location ? html.nothing : html`
			<li class="location field">
				<mitra-icon icon="map-pin"></mitra-icon>
				<mitra-location-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-location-field>
			</li>
		`
	}

	private get participantsTemplate() {
		// The field replaces `entry.participants` and fires `change`; the usual commit persists it (the
		// backend rejects a non-organizer's list change per iTIP — the field disables those paths anyway).
		return !this.capabilities.participants ? html.nothing : html`
			<li class="participants field">
				<mitra-icon icon="users"></mitra-icon>
				<mitra-participants-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-participants-field>
			</li>
		`
	}

	private get colorTemplate() {
		const activeColor = this.segment?.entry.color || this.source?.color
		return !this.segment?.entry ? html.nothing : html`
			<li class="color field">
				<mitra-icon icon="palette"></mitra-icon>
				<div class="content">
					<mitra-color-picker
						.value=${activeColor}
						.resetValue=${this.source?.color}
						resetLabel=${t('Reset to calendar color')}
						@change=${(e: CustomEvent<string | null>) => this.setColor(e.detail)}
					></mitra-color-picker>
				</div>
			</li>
		`
	}

	private setColor(color: string | null) {
		if (!this.segment) {
			return
		}

		if (color === this.source?.color) {
			color = null
		}

		this.segment.entry.color = color ?? null
		EntryStore.notify()
		this.handleChange().catch(() => void 0)
	}

	private get remindersTemplate() {
		// Reminders anchor to the start time — an undated entry has nothing to remind about.
		return !this.segment!.entry.start || !this.capabilities.reminders ? html.nothing : html`
			<li class="reminders field">
				<mitra-icon icon="bell"></mitra-icon>
				<mitra-reminders-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-reminders-field>
			</li>
		`
	}

	@state() private editingDescription = false

	private get descriptionTemplate() {
		const editDescription = (e: Event) => {
			// A click on a link should follow it rather than switch into edit mode.
			if (e.composedPath().some(node => node instanceof HTMLAnchorElement)) {
				return
			}
			this.editingDescription = true
			this.updateComplete.then(() => {
				const textarea = this.descriptionTextarea
				textarea?.focus()
				textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
			})
		}
		return !this.capabilities.description ? html.nothing : html`
			<li class="description field">
				<mitra-icon icon="align-left"></mitra-icon>
				${this.editingDescription ? html`
					<textarea rows="1" placeholder=${t('Description')}
						${this.bind('entry.description', 'input')}
						@change=${this.handleChange}
						@blur=${() => this.editingDescription = false}
					></textarea>
				` : html`
					<!-- Focusable, and focus IS the switch into edit mode: the rendered face is a view of the
						same field, so reaching it by keyboard has to put the caret in it like clicking does —
						otherwise Description was the one row Tab passed through with nothing to show. A click
						on a link focuses the ANCHOR, not this div, so links still just follow (the guard in
						editDescription covers the bubbled click). -->
					<div class="rendered" tabindex="0" @focus=${editDescription} @click=${editDescription}>
						${!this.segment!.entry.description ? html`
							<div class="placeholder">${t('Description')}</div>
							` : html`
								<mitra-markdown .value=${this.segment!.entry.description}></mitra-markdown>
						`}
					</div>
				`}
			</li>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-details': EntryDetailsComponent
	}
}
