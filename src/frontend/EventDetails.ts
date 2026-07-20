import { component, html, property, state, Component, css, eventListener, event, Binder } from '@a11d/lit'
import { EntryType, TaskStatus, SourceType, type Integration } from 'shared'
import type { EntrySegment } from './EntrySegment.js'
import { getIntegrations, getSource, getCapabilities } from './Api.js'
import { EntryStore } from './EntryStore.js'

@component('mitra-entry-details')
export class EntryDetailsComponent extends Component {
	@event() readonly openChange!: EventDispatcher<boolean>
	@property({
		type: Boolean,
		updated(this: EntryDetailsComponent) {
			if (this.open) {
				this.showPopover()
			} else {
				this.hidePopover()
			}
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
				requestAnimationFrame(() => this.querySelector<HTMLInputElement>('.title')?.focus())
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
	// the user SEES the failure; the console then carries the server's reason.
	private readonly handleDelete = () => {
		const entry = this.segment!.entry
		this.hidePopover()
		return EntryStore.delete(entry).catch(error =>
			console.error('Deleting the entry failed — it was restored in the view:', error))
	}

	private readonly handleClose = (e: Event) => {
		e.stopPropagation()
		this.hidePopover()
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
			mitra-entry-details {
				display: contents;
				cursor: default;

				/* Tint the toggle switch and the text selection with the entry's (or its source's) colour. */
				--color-accent: var(--mitra-entry-segment-color);

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
				overflow: hidden;

				position: fixed;
				margin-inline: 0.25rem;
				container-type: anchored;
				position-area: inline-end span-all;
				position-visibility: anchors-visible;
				position-try-order: most-block-size;
				position-try-fallbacks: flip-inline, flip-block, flip-block flip-inline;

				/* Wide enough for the times row to carry the inline zone chip ("GMT+3:30") next to the
				   end time without cramping the inputs. */
				width: 360px;
				max-height: 80dvh;
				overflow-y: auto;

				background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
				backdrop-filter: blur(10px);
				border: var(--border);
				border-radius: 0.5rem;
				box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48),0px 4px 12px -1px rgba(0,0,0,0.24);
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

				> ul {
					list-style: none;
					margin: 0;
					padding: 0.5rem 1rem 1rem;
					display: grid;
					/* Just two columns for the whole popover: a leading glyph (icon / checkbox / switch /
					   colour-square) and its content. Every row subgrids it so the glyphs line up. The
					   date/time editor does its own start/→/end alignment within the content column. */
					grid-template-columns: auto minmax(0, 1fr);
					row-gap: 1rem;
					column-gap: 0.5rem;

					> hr {
						margin: 0;
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
							align-items: start;

							> mitra-icon {
								margin-block-start: 2px;
							}

							> textarea, > .rendered {
								grid-column: 2 / -1;
							}

							> textarea {
								width: 100%;
								font: inherit;
								line-height: 1.4;
							}

							> .rendered {
								width: 100%;
								/* Match the .subtle textarea's box so toggling doesn't shift layout. */
								margin: -4px -4px;
								padding: 4px 4px;
								border-radius: var(--border-radius);
								cursor: text;

								&:hover {
									background: color-mix(in srgb, var(--color-text) 6%, transparent);
								}
							}

							.placeholder {
								color: var(--color-text-muted);
								opacity: 0.8;
								font-size: 0.8rem;
								line-height: 1.1rem;
							}
						}

						&.source {
							/* The whole row is a \`subtle\` select: it reads as plain text — the
							   selected option's own dot/type/name via <selectedcontent> — until hovered. */
							> select {
								display: grid;
								grid-template-columns: subgrid;
								grid-column: -1 / 1;

								/* The picker wears the popover's tinted glass, border, and shadow (it inherits the
								   segment colour var), so the two read as one plane. It prefers opening beside
								   the row and flips inline/block when the space runs out — the same strategy as
								   the details popover itself. */
								&::picker(select) {
									background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
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

								selectedcontent {
									display: flex;
									align-items: center;
									gap: 0.5rem;
									display: grid;
									grid-template-columns: subgrid;
									grid-column: -1 / 1;

									.dot { font-size: 0.8rem; margin-inline-start: 2px; }
									.type { font-size: 0.87rem; color: var(--color-text-muted); }
									div {
										display: flex;
										gap: 0.25rem;
										align-items: center;
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
									border-radius: var(--border-radius);
									.type { font-size: 0.87rem; color: var(--color-text-muted); }
									.name { flex: 1; }
								}
							}
						}

						&.color {
							.content {
								gap: 0.375rem;
							}
						}

						/* A long location wraps over several lines — keep the pin on the first one. */
						&.location {
							align-items: start;

							> mitra-icon {
								margin-block-start: 3px;
							}
						}

						/* Several reminder rows stack — keep the bell on the first one. */
						&.reminders {
							align-items: start;

							> mitra-icon {
								margin-block-start: 3px;
							}
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
						<input class="title subtle" placeholder=${t('Title')}
							?data-struck=${this.segment.entry.status === TaskStatus.Done || this.segment.entry.status === TaskStatus.Cancelled}
							${this.bind('entry.heading', 'input')} @change=${this.handleChange}>
						<mitra-icon-button
							label=${t('Options')}
							icon="more-horizontal"
							style="anchor-name: --entry-menu-${this.segment.entry.id}; color: var(--color-text-muted)"
							@click=${this.toggleMenu}
						></mitra-icon-button>
						<menu popover id="entry-menu-${this.segment.entry.id}" style="position-anchor: --entry-menu-${this.segment.entry.id}">
							<button class="danger" @click=${this.handleDelete}>
								<mitra-icon icon="trash-2"></mitra-icon>
								${t('Delete')}
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
				${!this.capabilities.location && !this.capabilities.description ? html.nothing : html`
					${this.locationTemplate}
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
			<li class="source">
				<select class="subtle" @change=${handleSourceChange}>
					<button>
						<selectedcontent></selectedcontent>
					</button>
					${getIntegrations().map(integration => {
						const sources = [...integration.sources].filter(source =>
							source.id === entry.sourceId || (source.visible && canHold(integration)))
						return !sources.length ? html.nothing : html`
							<optgroup label=${integration.credentials?.username || integration.type}>
								<legend>${integration.credentials?.username || integration.type}</legend>
								${sources.map(source => html`
									<option value=${source.id} ?selected=${source.id === entry.sourceId}>
										<mitra-icon class="dot" icon="square" fill style="color: ${source.color || 'var(--color-text-muted)'}"></mitra-icon>
										<div>
											<mitra-icon class="type" icon=${source.type === SourceType.Task ? 'list-todo' : 'calendar'}></mitra-icon>
											<span class="name">${source.name}</span>
										</div>
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
			<li class="location">
				<mitra-icon icon="map-pin"></mitra-icon>
				<mitra-location-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-location-field>
			</li>
		`
	}

	private get colorTemplate() {
		const activeColor = this.segment?.entry.color || this.source?.color
		return !this.segment?.entry ? html.nothing : html`
			<li class="color">
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
			<li class="reminders">
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
				const textarea = this.querySelector<HTMLTextAreaElement>('.description textarea')
				textarea?.focus()
				textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
			})
		}
		return !this.capabilities.description ? html.nothing : html`
			<li class="description">
				<mitra-icon icon="align-left"></mitra-icon>
				${this.editingDescription ? html`
					<textarea class="subtle" rows="1" placeholder=${t('Description')}
						${this.bind('entry.description', 'input')}
						@change=${this.handleChange}
						@blur=${() => this.editingDescription = false}
					></textarea>
				` : html`
					<div class="rendered" @click=${editDescription}>
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
