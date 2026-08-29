import { component, html, join, property, state, Component, css, eventListener, event, Binder, query } from '@a11d/lit'
import { type Source } from '../../sources/Source.js'
import { EntryType, type EntryTypeValue } from '../EntryType.js'
import { TaskStatus, Transparency } from '../Entry.js'
import type { EntrySegment } from './EntrySegment.js'
import { getIntegrations, getSource, getCapabilities, getExternalLink } from '../../../infrastructure/http/Api.js'
import { EntryStore, reportSaveError } from './EntryStore.js'
import * as Hierarchy from '../../relations/client/Hierarchy.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { closeSheet } from '../../../design/sheet.js'
import { EntryDetailsSharing } from './EntryDetailsSharing.js'

@component('mitra-entry-details')
export class EntryDetailsComponent extends Component {
	@event() readonly openChange!: EventDispatcher<boolean>
	@property({
		type: Boolean,
		updated(this: EntryDetailsComponent) {
			// Defers native popover toggle to next frame to prevent immediate dismiss from tap clicks.
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

	readonly store = new EntryStore(this)

	private get source() {
		return this.segment?.entry.sourceId ? getSource(this.segment.entry.sourceId) : undefined
	}

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
			if (!this.segment?.entry.heading?.trim()) {
				requestAnimationFrame(() => this.titleInput?.focus())
			}
		}
	}

	private readonly handleChange = () => {
		return EntryStore.commit(this.segment!.entry)
	}

	private readonly handleInPlaceEdit = () => {
		EntryStore.notify()
		this.handleChange().catch(reportSaveError)
	}

	private readonly handleDelete = async (bypass: boolean) => {
		const entry = this.segment!.entry
		const scope = await Hierarchy.resolveScope(entry, 'delete', bypass)
		if (!scope) {
			return
		}
		this.hidePopover()
		return Hierarchy.deleteScoped(entry, scope).catch(error =>
			console.error('Deleting the entry failed — it was restored in the view:', error))
	}

	private static bypassesScope(e: MouseEvent | KeyboardEvent): boolean {
		return e.ctrlKey || e.metaKey
	}

	private readonly handleDuplicate = () => {
		const entry = this.segment!.entry
		this.hidePopover()
		return EntryStore.duplicate(entry)
			.then(copy => EntryEditorIntent.requestOpen(copy.id!))
			.catch(error => console.error('Duplicating the entry failed — nothing was added:', error))
	}

	private static readonly appleKeyboard = /Mac|iPhone|iPad/.test(navigator.platform)

	private static get altKey() { return EntryDetailsComponent.appleKeyboard ? '⌥' : 'Alt' }

	@eventListener({ target: window, type: 'keydown' })
	protected handleWindowKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Delete' && e.key !== 'Backspace') {
			return
		}
		const target = e.target
		const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
			|| target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
		if (!this.open || editable || e.altKey || e.isComposing || !this.capabilities.deleteEntries) {
			return
		}
		e.preventDefault()
		void this.handleDelete(EntryDetailsComponent.bypassesScope(e))
	}

	private readonly handleClose = (e: Event) => {
		e.stopPropagation()
		if (!closeSheet(this)) {
			this.hidePopover()
		}
	}

	private get externalLinkTemplate() {
		const link = getExternalLink(this.segment!.entry)
		return !link ? html.nothing : html`
			<button @click=${() => window.open(link.url, '_blank', 'noopener,noreferrer')}>
				<mitra-icon icon="external-link"></mitra-icon>
				${link.label ? t('Open in ${provider}', { provider: link.label }) : t('Open link')}
			</button>
		`
	}

	private readonly toggleMenu = (e: Event) => {
		(e.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>('menu[popover]')?.togglePopover()
	}

	private get hasMenu() {
		return !!getExternalLink(this.segment!.entry)
			|| (this.segment!.entry.persisted && this.capabilities.createEntries)
			|| this.capabilities.deleteEntries
	}

	private readonly binder = new Binder(this, 'segment')

	private bind = (keyPath: KeyPath.Of<EntrySegment>, event = 'change') => {
		return this.binder.bind({ keyPath, event, sourceUpdated: () => EntryStore.notify() })
	}

	static override get styles() {
		return css`
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
				display: none;
				cursor: default;

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

				--sheet-frame-radius: 0.5rem;
				--sheet-frame-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);

				position: fixed;
				margin-inline: 0.25rem;
				position-area: inline-end span-all;
				position-visibility: anchors-visible;
				position-try-fallbacks: flip-inline, --sheet;

				@media (width >= 40rem) {
					position-try-fallbacks: flip-inline, --below, --above, --sheet;
				}

				width: 360px;
				max-height: 80dvh;

				color: var(--color-text);
				font-family: 'Inter', sans-serif;
				font-size: 0.75rem;

				&::backdrop {
					background: transparent;
				}

				> .editor {
					--gutter: 1.5rem;
					--inset: 1rem 0.5rem;
					max-height: inherit;
					display: flex;
					flex-direction: column;
					background: var(--mitra-entry-surface);
					backdrop-filter: blur(10px);
					border: var(--border);
					border-radius: var(--sheet-frame-radius);
					overflow: clip;

					> header {
						flex-shrink: 0;
						display: flex;
						flex-direction: column;
						gap: 0.25rem;
						padding-block: 0.4375rem 0.375rem;
						padding-inline: var(--inset);
						border-block-end: 1px solid color-mix(in srgb, var(--color-text) 6%, transparent);
						font-size: 0.75rem;

						> .toolbar {
							display: grid;
							grid-template-columns: var(--gutter) minmax(0, 1fr);
							column-gap: 0.5rem;
							align-items: center;

							> .bar {
								grid-column: 2;
								display: flex;
								align-items: center;
								margin-inline: -0.4375rem -0.25rem;
							}

							> .bar > .spacer { flex: 1; }

							mitra-icon-button {
								font-size: 0.8125rem;
							}

							:is(.entry-type, .source).field {
								--control-height: 1.5rem;
								--field-padding-inline: 0.4375rem;
							}

							.source > select option > .name {
								flex: 1;
							}

							.source > select selectedcontent {
								display: block;
								max-width: 10rem;
								overflow: hidden;
								text-overflow: ellipsis;
								white-space: nowrap;

								mitra-source-icon {
									display: none;
								}
							}

							> .color {
								grid-column: 1;
								display: inline-flex;
								align-items: center;

								> .dot {
									width: 0.875rem;
									height: 0.875rem;
									border-radius: var(--border-radius);
									border: none;
									cursor: pointer;
									padding: 0;
									transition: transform 0.1s;

									&:hover {
										transform: scale(1.15);
									}
								}

								> menu[popover] {
									padding: 0.5rem;
									flex-direction: row;
								}
							}
						}

						> .title-row {
							display: grid;
							grid-template-columns: var(--gutter) minmax(0, 1fr);
							column-gap: 0.5rem;
							align-items: center;

							> mitra-task-status {
								grid-column: 1;
								font-size: 0.95rem;
							}

							> .title {
								grid-column: 2;
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
					}

					> ul {
						list-style: none;
						margin: 0;
						padding-block: 0.375rem 0.75rem;
						padding-inline: var(--inset);
						overflow-y: auto;
						min-height: 0;
						display: grid;
						grid-template-columns: var(--gutter) minmax(0, 1fr);
						grid-auto-rows: min-content;
						row-gap: 0.125rem;
						column-gap: 0.5rem;

						> hr {
							margin: 0.5rem 0;
							background: color-mix(in srgb, var(--color-text) 6%, transparent);
							width: 100%;
							height: 1px;
							outline: none;
							border: none;
							grid-column: -1 / 1;

							&:has(+ mitra-relations-field[data-empty]) {
								display: none;
							}
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

							&.field {
								margin-inline: -0.5rem -0.25rem;
							}

							> .content {
								grid-column: 2 / -1;
								display: flex;
								align-items: center;
								flex-wrap: wrap;
								opacity: 0.85;
							}

							&.description {
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
								> mitra-source-icon {
									grid-area: 1 / 1;
									pointer-events: none;
									font-size: 0.875rem;
								}

								> select {
									display: grid;
									grid-template-columns: subgrid;
									grid-row: 1;
									grid-column: -1 / 1;

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
				}

				@container anchored(fallback: --sheet) {
					& > .editor > ul {
						padding-block-end: max(1rem, env(safe-area-inset-bottom));
					}
				}
			}
		`
	}

	protected override get template() {
		return !this.segment ? html.nothing : html`
			<div class="editor">
				<header>
					<div class="toolbar">
						${this.colorTemplate}
						<span class="bar">
							${this.sourceTemplate}
							<span class="spacer"></span>
							${this.entryTypeTemplate}
							${!this.hasMenu ? html.nothing : html`
								<mitra-icon-button
									label=${t('Options')}
									icon="more-horizontal"
									style="anchor-name: --entry-menu-${this.segment.entry.id}; color: var(--color-text-muted)"
									@click=${this.toggleMenu}
								></mitra-icon-button>
							`}
							<menu popover id="entry-menu-${this.segment.entry.id}" style="position-anchor: --entry-menu-${this.segment.entry.id}">
								${this.externalLinkTemplate}
								${!this.segment.entry.persisted || !this.capabilities.createEntries ? html.nothing : html`
									<button @click=${this.handleDuplicate}>
										<mitra-icon icon="copy"></mitra-icon>
										${t('Duplicate')}
										<kbd>${EntryDetailsComponent.altKey}</kbd>
										<span class="word">${t('drag')}</span>
									</button>
								`}
								${!this.capabilities.deleteEntries ? html.nothing : html`
									<button class="danger" @click=${(e: MouseEvent) => void this.handleDelete(EntryDetailsComponent.bypassesScope(e))}>
										<mitra-icon icon="trash-2"></mitra-icon>
										${t('Delete')}
										<kbd>${EntryDetailsComponent.appleKeyboard ? '⌫' : 'Del'}</kbd>
									</button>
								`}
							</menu>
							<mitra-icon-button class="close" icon="x" label=${t('Close')}
								style="color: var(--color-text-muted)"
								@click=${this.handleClose}
							></mitra-icon-button>
						</span>
					</div>
					${this.titleRowTemplate}
				</header>
				<ul>
					${join(this.groups, html`<hr>`)}
				</ul>
			</div>
		`
	}

	private get titleRowTemplate() {
		const entry = this.segment!.entry
		return html`
			<div class="title-row">
				${!entry.type.isTask ? html.nothing : html`
					<mitra-task-status .entry=${entry} @change=${this.handleInPlaceEdit}></mitra-task-status>
				`}
				<input class="title field" placeholder=${t('Title')}
					?readonly=${!this.capabilities.editEntries || (entry.persisted && !this.capabilities.renameEntries)}
					?data-struck=${entry.status === TaskStatus.Done || entry.status === TaskStatus.Cancelled}
					${this.bind('entry.heading', 'input')} @change=${this.handleChange}>
			</div>
		`
	}

	/**
	 * The popover's rows in GROUPS, empty ones dropped — a separator then rides strictly BETWEEN what
	 * remains ({@link join}), so it cannot double up, lead, or trail. That matters because what a row
	 * has to say is the PROVIDER's answer, not this template's: a Notion task has no free/busy, no
	 * visibility and no reminders, so its whole third group vanishes — and used to leave its neighbour's
	 * separator sitting against the next one.
	 *
	 * Emptiness is each row's OWN answer (`html.nothing`, which every row template already returns when
	 * its capability is off) — never re-derived here, or the two would drift. The one row that cannot
	 * answer as a template is the sharing element, which decides inside itself; it exposes the same
	 * question as {@link EntryDetailsSharing.applies}.
	 *
	 * The order is the argument: everything up to reminders describes THIS entry, so relationships —
	 * which connect it to OTHERS, and whose rows grow — close the popover as their own group.
	 */
	private get groups() {
		const entry = this.segment!.entry
		const groups = [
			// Rendered for an UNDATED entry too, where it shows just the way in (see EntryDetailsWhen).
			[html`<mitra-entry-details-when .entry=${entry} @change=${this.handleInPlaceEdit}></mitra-entry-details-when>`],
			[this.locationTemplate, this.participantsTemplate, this.descriptionTemplate],
			[
				!EntryDetailsSharing.applies(entry) ? html.nothing : html`
					<mitra-entry-details-sharing .entry=${entry} @change=${this.handleInPlaceEdit}></mitra-entry-details-sharing>
				`,
				this.remindersTemplate,
			],
			[html`<mitra-relations-field .entry=${entry}></mitra-relations-field>`],
		]
		return groups
			.map(rows => rows.filter(row => row !== html.nothing))
			.filter(rows => rows.length > 0)
	}

	private get entryTypeTemplate() {
		const entry = this.segment!.entry
		const source = this.source
		const switchable = this.capabilities.editEntries && !!source?.supportsEntryType(EntryType.Event) && !!source.supportsEntryType(EntryType.Task) && !entry.partOfSeries
		if (!switchable) {
			return html.nothing
		}
		const handleTypeChange = (e: Event) => {
			entry.type = (e.target as HTMLSelectElement).value as EntryTypeValue
			EntryStore.notify()
			this.handleChange().catch(reportSaveError)
		}
		return html`
			<span class="entry-type field">
				<select @change=${handleTypeChange}>
					<button>
						<selectedcontent></selectedcontent>
					</button>
					${EntryType.all.map(type => html`
						<option value=${type.value} ?selected=${type === entry.type}>${type.format()}</option>
					`)}
				</select>
			</span>
		`
	}

	private get sourceTemplate() {
		const handleSourceChange = (e: Event) => {
			const sourceId = (e.target as HTMLSelectElement).value
			const source = getIntegrations().flatMap(integration => [...integration.sources]).find(source => source.id === sourceId)
			const entry = this.segment!.entry
			if (!source || source.id === entry.sourceId) {
				return
			}
			entry.migrateTo(source)
			EntryStore.notify()
			this.handleChange().catch(reportSaveError)
		}
		const entry = this.segment!.entry
		const canHold = (target: Source) => {
			const capabilities = getCapabilities(target.id)
			return capabilities.createEntries
				&& (!entry.partOfSeries || capabilities.recurrence)
				&& (entry.status !== TaskStatus.Cancelled || capabilities.cancelledStatus)
				&& (entry.transparency !== Transparency.Free || capabilities.transparency)
				&& (!entry.visibility || capabilities.visibility)
		}
		return !this.source?.name ? html.nothing : html`
			<span class="source field">
				<select ?disabled=${!this.capabilities.editEntries} @change=${handleSourceChange}>
					<button>
						<selectedcontent></selectedcontent>
					</button>
					${getIntegrations().map(integration => {
						const sources = [...integration.sources].filter(source =>
							source.id === entry.sourceId || (source.enabled && canHold(source)))
						return !sources.length ? html.nothing : html`
							<optgroup label=${integration.credentials?.username || integration.type}>
								<legend>${integration.credentials?.username || integration.type}</legend>
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
			</span>
		`
	}

	private get locationTemplate() {
		return !this.capabilities.location ? html.nothing : html`
			<li class="location field">
				<mitra-icon icon="map-pin"></mitra-icon>
				<mitra-location-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-location-field>
			</li>
		`
	}

	private get participantsTemplate() {
		return !this.capabilities.participants ? html.nothing : html`
			<li class="participants field">
				<mitra-icon icon="users"></mitra-icon>
				<mitra-participants-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-participants-field>
			</li>
		`
	}

	private readonly handleColorChange = (e: CustomEvent<string | null>) => {
		this.setColor(e.detail)
		;((e.target as HTMLElement).closest('[popover]') as HTMLElement | null)?.hidePopover()
	}

	private get colorTemplate() {
		const entry = this.segment?.entry
		const activeColor = entry?.color || this.source?.color
		return !entry ? html.nothing : html`
			<span class="color">
				<button class="dot" ?disabled=${!this.capabilities.editEntries} popovertarget="entry-color-${entry.id}" title=${t('Color')}
					style="anchor-name: --entry-color-${entry.id}; background: ${activeColor ?? 'var(--color-text-muted)'}"></button>
				<menu popover id="entry-color-${entry.id}" style="position-anchor: --entry-color-${entry.id}">
					<mitra-color-picker
						.value=${activeColor}
						.resetValue=${this.source?.color}
						resetLabel=${t('Reset to calendar color')}
						@change=${this.handleColorChange}
					></mitra-color-picker>
				</menu>
			</span>
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
		return !this.segment!.entry.start || !this.capabilities.reminders ? html.nothing : html`
			<li class="reminders field">
				<mitra-icon icon="bell"></mitra-icon>
				<mitra-reminders-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-reminders-field>
			</li>
		`
	}

	@state() private editingDescription = false

	private readonly handleChecklistToggle = (e: CustomEvent<{ index: number, checked: boolean }>) => {
		const entry = this.segment!.entry
		entry.description = entry.checklist.toggle(e.detail.index, e.detail.checked)
		this.handleInPlaceEdit()
	}

	private get descriptionTemplate() {
		const editDescription = (e: Event) => {
			if (!this.capabilities.editEntries || e.composedPath().some(node => node instanceof HTMLAnchorElement || node instanceof HTMLInputElement)) {
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
					<div class="rendered" tabindex=${this.capabilities.editEntries ? '0' : '-1'} @focus=${editDescription} @click=${editDescription}>
						${!this.segment!.entry.description ? html`
							<div class="placeholder">${t('Description')}</div>
							` : html`
								<mitra-markdown .value=${this.segment!.entry.description}
									?interactive=${this.capabilities.editEntries}
									@check=${this.handleChecklistToggle}
								></mitra-markdown>
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
