import { component, html, property, state, Component, css, eventListener, event, Binder } from '@a11d/lit'
import type { EntrySegment } from './EntrySegment.js'
import { getSource, updateEvent, deleteEvent, createEvent } from './Api.js'
import { DraftController } from './DraftController.js'

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

	@event() readonly change!: EventDispatcher
	@property({ type: Object }) segment?: EntrySegment

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
			requestAnimationFrame(() => {
				const title = this.querySelector<HTMLInputElement>('.title')
				title?.focus()
				title?.select()
			})
		}
	}

	// The in-flight create request, kept so a follow-up edit waits for it to land before issuing an update.
	private creating?: Promise<unknown>

	private readonly handleChange = async () => {
		const entry = this.segment!.entry
		if (!entry.persisted) {
			// An untitled draft isn't committed yet; once a create is in flight, ignore further changes
			// (the binder keeps the entry's fields up to date) until it lands and the entry gets its id.
			if (this.creating || !entry.heading?.trim()) {
				return
			}
			try {
				const created = await (this.creating = createEvent(entry))
				DraftController.confirmCreated(entry, created.id!) // now persisted; reconcile() drops it on echo
			} catch (error) {
				this.creating = undefined // create failed — let the user retry (it's still a dashed draft)
				throw error
			}
		} else {
			await this.creating // if a create is mid-flight, let it land first (a no-op once settled)
			await updateEvent(entry)
		}
	}

	private readonly handleDelete = async () => {
		const entry = this.segment!.entry
		this.hidePopover()
		// A never-saved draft is only local; otherwise delete on the server (discard clears any optimistic copy).
		if (!entry.persisted) {
			DraftController.discard()
		} else {
			await deleteEvent(entry.id!)
			DraftController.discard()
		}
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
		return this.binder.bind({ keyPath, event, sourceUpdated: () => this.change.dispatch() })
	}

	static override get styles() {
		return css`
			mitra-entry-details {
				display: contents;
				cursor: default;

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

				> .header {
					display: flex;
					align-items: center;
					gap: 0.25rem;
					padding: 0.5rem 0.5rem 0.5rem 0.875rem;

					> .title {
						flex: 1;
						font-size: 0.9375rem;
						font-weight: 600;
						color: var(--color-text);
						line-height: 1.3;
					}
				}

				> ul {
					list-style: none;
					margin: 0;
					padding: 0.5rem 1rem 1rem;
					display: grid;
					grid-template-columns: auto minmax(0, 1fr);
					gap: 1rem;

					> li {
						display: grid;
						grid-template-columns: subgrid;
						grid-column: -1 / 1;
						align-items: center;
						gap: 0.625rem;

						> mitra-icon {
							font-size: 0.87rem;
							color: var(--color-text-muted);
							flex-shrink: 0;
						}

						> .content {
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

							> mitra-icon {
								margin-block-start: 2px;
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
							> .dot {
								width: 11px;
								height: 11px;
								border-radius: var(--border-radius);
								flex-shrink: 0;
								margin-inline-start: 2px;
							}
						}

						&.color {
							.content {
								gap: 0.375rem;
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
		`
	}

	protected override get template() {
		return !this.segment ? html.nothing : html`
			<header class="header">
				<input class="title subtle" placeholder="Title" ${this.bind('entry.heading', 'input')} @change=${this.handleChange}>
				<mitra-icon-button
					label="Options"
					icon="more-horizontal"
					style="anchor-name: --entry-menu-${this.segment.entry.id}"
					@click=${this.toggleMenu}
				></mitra-icon-button>
				<menu popover id="entry-menu-${this.segment.entry.id}" style="position-anchor: --entry-menu-${this.segment.entry.id}">
					<button class="danger" @click=${this.handleDelete}>
						<mitra-icon icon="trash-2"></mitra-icon> Delete
					</button>
				</menu>
				<mitra-icon-button class="close" icon="x" label="Close" @click=${this.handleClose}></mitra-icon-button>
			</header>
			<ul>
				${this.segment.allDay ? html.nothing : html`
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
				${this.sourceTemplate}
				${this.colorTemplate}
				${this.descriptionTemplate}
			</ul>
		`
	}

	private get sourceTemplate() {
		return !this.source?.name ? html.nothing : html`
			<li class="source">
				<span class="dot" style="background: ${this.source.color}"></span>
				<div class="content">${this.source.name}</div>
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
		this.handleChange()
		this.requestUpdate()
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
