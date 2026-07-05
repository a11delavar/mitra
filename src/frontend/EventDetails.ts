import { component, html, property, state, Component, css, eventListener, event, Binder } from '@a11d/lit'
import { EntryType, TaskStatus, SourceType } from 'shared'
import type { EntrySegment } from './EntrySegment.js'
import { getIntegrations, getSource } from './Api.js'
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

	// The task checkbox/menu mutated `entry.status`: render it everywhere this frame, then persist.
	private readonly handleStatusChange = () => {
		EntryStore.notify()
		this.handleChange().catch(() => void 0)
	}

	// The <mitra-entry-details-when> editor mutated the entry's span in place: render, then persist.
	private readonly handleWhenChange = () => {
		EntryStore.notify()
		this.handleChange().catch(() => void 0)
	}

	private readonly handleDelete = () => {
		const entry = this.segment!.entry
		this.hidePopover()
		return EntryStore.delete(entry)
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

				width: 300px;
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
							border-block-start: 1px solid rgba(255, 255, 255, 0.06);
							padding-block-start: 0.6875rem;
							margin-block-start: 0.375rem;

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
								margin: -2px -4px;
								padding: 2px 4px;
								border-radius: var(--border-radius);
								cursor: text;

								&:hover {
									background: color-mix(in srgb, var(--color-text) 6%, transparent);
								}
							}

							.placeholder {
								color: var(--color-text-muted);
								line-height: 1.1rem;
							}
						}

						&.source {
							/* The whole row is a \`subtle\` select, Notion-style: it reads as plain text — the
							   selected option's own dot/type/name via <selectedcontent> — until hovered. */
							> select {
								grid-column: 1 / -1;

								/* The picker wears the popover's tinted glass, border, and shadow (it inherits the
								   segment colour var), so the two read as one plane. It prefers opening beside
								   the row — right, then left — and only falls back to a regular dropdown below/
								   above it when neither side fits. Explicit areas, not flip tactics: Chrome
								   doesn't (yet) apply \`flip-inline\` to \`position-area\`, it silently skips. */
								&::picker(select) {
									background: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
									border: var(--border);
									box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48),0px 4px 12px -1px rgba(0,0,0,0.24);
									position-area: inline-end span-all;
									position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
									margin-inline: 0.875rem;
								}

								selectedcontent {
									display: flex;
									align-items: center;
									gap: 0.5rem;

									.dot { font-size: 0.8rem; margin-inline-start: 2px; }
									.type { font-size: 0.87rem; color: var(--color-text-muted); }
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
						<input class="title subtle" placeholder="Title"
							?data-struck=${this.segment.entry.status === TaskStatus.Done || this.segment.entry.status === TaskStatus.Cancelled}
							${this.bind('entry.heading', 'input')} @change=${this.handleChange}>
						<mitra-icon-button
							label="Options"
							icon="more-horizontal"
							style="anchor-name: --entry-menu-${this.segment.entry.id}; color: var(--color-text-muted)"
							@click=${this.toggleMenu}
						></mitra-icon-button>
						<menu popover id="entry-menu-${this.segment.entry.id}" style="position-anchor: --entry-menu-${this.segment.entry.id}">
							<button class="danger" @click=${this.handleDelete}>
								<mitra-icon icon="trash-2"></mitra-icon>
								Delete
							</button>
						</menu>
						<mitra-icon-button class="close" icon="x" label="Close"
							style="color: var(--color-text-muted)"
							@click=${this.handleClose}
						></mitra-icon-button>
					</div>
				</li>
				${!this.segment.entry.start ? html.nothing : html`
					<mitra-entry-details-when .entry=${this.segment.entry} @change=${this.handleWhenChange}></mitra-entry-details-when>
				`}
				${this.sourceTemplate}
				${this.colorTemplate}
				${this.descriptionTemplate}
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
			this.handleChange().catch(() => void 0)
		}
		const entry = this.segment!.entry
		return !this.source?.name ? html.nothing : html`
			<li class="source">
				<select class="subtle" @change=${handleSourceChange}>
					<button>
						<selectedcontent></selectedcontent>
					</button>
					${getIntegrations().map(integration => {
						const sources = [...integration.sources].filter(source => source.visible || source.id === entry.sourceId)
						return !sources.length ? html.nothing : html`
							<optgroup label=${integration.credentials?.username || integration.type}>
								<legend>${integration.credentials?.username || integration.type}</legend>
								${sources.map(source => html`
									<option value=${source.id} ?selected=${source.id === entry.sourceId}>
										<mitra-icon class="dot" icon="square" fill style="color: ${source.color || 'var(--color-text-muted)'}"></mitra-icon>
										<mitra-icon class="type" icon=${source.type === SourceType.Task ? 'list-todo' : 'calendar'}></mitra-icon>
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

	private get colorTemplate() {
		const activeColor = this.segment?.entry.color || this.source?.color
		return !this.segment?.entry ? html.nothing : html`
			<li class="color">
				<mitra-icon icon="palette"></mitra-icon>
				<div class="content">
					<mitra-color-picker
						.value=${activeColor}
						.resetValue=${this.source?.color}
						resetLabel="Reset to calendar color"
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
		return html`
			<li class="description">
				<mitra-icon icon="align-left"></mitra-icon>
				${this.editingDescription ? html`
					<textarea class="subtle" rows="1" placeholder="Add a description"
						${this.bind('entry.description', 'input')}
						@change=${this.handleChange}
						@blur=${() => this.editingDescription = false}
					></textarea>
				` : html`
					<div class="rendered" @click=${editDescription}>
						${!this.segment!.entry.description ? html`
							<div class="placeholder">Add a description</div>
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
