import { component, html, join, property, state, Component, css, eventListener, event, Binder, query } from '@a11d/lit'
import { type Source } from '../../sources/Source.js'
import { Color } from '../../sources/Color.js'
import { EntryType, type EntryTypeValue } from '../EntryType.js'
import { TaskStatus, Transparency } from '../Entry.js'
import type { EntrySegment } from './EntrySegment.js'
import { getIntegrations, getSource, getCapabilities, getExternalLink } from '../../../infrastructure/http/Api.js'
import { EntryStore, reportSaveError } from './EntryStore.js'
import * as Hierarchy from '../../relations/client/Hierarchy.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { centered, type Popover } from '../../../design/Popover.js'
import { EntryDetailsSharing } from './EntryDetailsSharing.js'
import { startedInField } from '../../../design/eventOrigin.js'
import { editorFieldStyles } from './editorFields.css.js'

@component('mitra-entry-details')
export class EntryDetailsComponent extends Component {
	@event() readonly openChange!: EventDispatcher<boolean>
	@property({
		type: Boolean,
		updated(this: EntryDetailsComponent) {
			// Deferred a frame, so the tap that opened it is not also the press outside that dismisses it.
			requestAnimationFrame(() => {
				if (!this.isConnected) {
					return
				}
				if (this.open) {
					this.popoverElement?.show(this.closest('mitra-entry-segment') ?? undefined)
				} else {
					this.popoverElement?.hide()
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

	/** Its popover, which is anchored at the segment, centered where it has no room, and a sheet on a phone. */
	@query('mitra-popover') private readonly popoverElement?: Popover
	@query('.title') private readonly titleInput?: HTMLInputElement
	@query('.description textarea') private readonly descriptionTextarea?: HTMLTextAreaElement

	private readonly handleOpenChange = (e: CustomEvent<boolean>) => {
		if (e.detail !== this.open) {
			this.open = e.detail
			this.openChange.dispatch(e.detail)
		}
		if (e.detail && !this.segment?.entry.heading?.trim()) {
			requestAnimationFrame(() => this.titleInput?.focus())
		}
	}

	/** Closes the editor, as its X does: a sheet slides away first. */
	close() {
		this.popoverElement?.hide()
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
		this.close()
		return Hierarchy.deleteScoped(entry, scope).catch(error =>
			console.error('Deleting the entry failed, so it was restored in the view:', error))
	}

	private static bypassesScope(e: MouseEvent | KeyboardEvent): boolean {
		return e.ctrlKey || e.metaKey
	}

	private readonly handleDuplicate = () => {
		const entry = this.segment!.entry
		this.close()
		return EntryStore.duplicate(entry)
			.then(copy => EntryEditorIntent.requestOpen(copy.id!))
			.catch(error => console.error('Duplicating the entry failed, so nothing was added:', error))
	}

	private static readonly appleKeyboard = /Mac|iPhone|iPad/.test(navigator.platform)

	private static get altKey() { return EntryDetailsComponent.appleKeyboard ? '⌥' : 'Alt' }

	@eventListener({ target: window, type: 'keydown' })
	protected handleWindowKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Delete' && e.key !== 'Backspace') {
			return
		}
		if (!this.open || startedInField(e) || e.altKey || e.isComposing || !this.capabilities.deleteEntries) {
			return
		}
		e.preventDefault()
		void this.handleDelete(EntryDetailsComponent.bypassesScope(e))
	}

	private readonly handleClose = (e: Event) => {
		e.stopPropagation()
		this.close()
	}

	private get externalLinkTemplate() {
		const link = getExternalLink(this.segment!.entry)
		return !link ? html.nothing : html`
			<mitra-menu-item icon="external-link" href=${link.url} target="_blank">
				${link.label ? t('Open in ${provider}', { provider: link.label }) : t('Open link')}
			</mitra-menu-item>
		`
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
			${editorFieldStyles}
			${centered}

			mitra-entry-details {
				display: contents;
				cursor: default;
				color: var(--color-text);
				font-family: 'Inter', sans-serif;
				font-size: 0.75rem;

				& ::selection {
					background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 40%, transparent);
				}

				/* Beside its segment, or where neither side has room, in the middle of the viewport as a dialog. The frame
				   is the editor's own, so the popover's surface steps aside. */
				> mitra-popover:not([data-sheet]) {
					inline-size: 360px;
					max-block-size: 80dvh;
					margin: 0 0.25rem;
					padding: 0;
					border: none;
					border-radius: 0.5rem;
					background: none;
					backdrop-filter: none;
					box-shadow: 0px 24px 48px -8px rgba(0,0,0,0.48), 0px 4px 12px -1px rgba(0,0,0,0.24);
					overflow: clip;
					position-area: inline-end span-all;
					position-visibility: anchors-visible;
					position-try-fallbacks: flip-inline, --centered;

					&:popover-open {
						display: flex;
						flex-direction: column;
					}
				}

				> mitra-popover > .editor {
					--gutter: 1.5rem;
					/* Rows' fields overhang it by 0.5rem on both sides, so a field's box sits 0.5rem from either edge. */
					--inset: 1rem;
					min-block-size: 0;
					display: flex;
					flex-direction: column;
					background: var(--mitra-entry-surface);
					backdrop-filter: blur(10px);
					border: var(--border);
					border-radius: 0.5rem;
					overflow: clip;

					> header {
						flex-shrink: 0;
						display: flex;
						flex-direction: column;
						gap: 0.25rem;
						/* The close button's box keeps the same distance from the top and the end edge. */
						padding-block: 0.5rem 0.375rem;
						padding-inline: var(--inset) 0.5rem;
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
								margin-inline-start: -0.4375rem;
							}

							> .bar > .spacer { flex: 1; }

							mitra-icon-button {
								color: var(--color-text-muted);
							}

							:is(.entry-type, .source).field {
								--control-height: 1.5rem;
								--field-padding-inline: 0.4375rem;
							}

							.source mitra-select::part(value) {
								max-inline-size: 10rem;
							}

							> .color {
								grid-column: 1;
								display: inline-flex;
								align-items: center;

								> mitra-popover-container > .dot::part(button) {
									inline-size: 0.875rem;
									min-block-size: 0.875rem;
									padding: 0;
									border: none;
									background: var(--dot);
									transition: transform 0.1s;
								}

								> mitra-popover-container > .dot::part(button):hover {
									transform: scale(1.15);
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
								/* Overhangs its column at the start like every row's field, and ends where the header does. */
								inline-size: calc(100% + 0.5rem);
								max-inline-size: none;
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

						/* The rows' pickers open beside the editor rather than over it; a dialog's open at their controls. */
						:where(.field [popover]:not(mitra-dialog *)),
						:where(.field mitra-select:not(mitra-dialog *))::part(listbox) {
							min-inline-size: 10rem;
							position-area: inline-end span-all;
							position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block;
							margin: 0 0.875rem;
						}

						/* A row's trailing action lands its glyph as far from the field's end as the row's icon sits from its start. */
						.field mitra-icon-button.add {
							margin-inline-end: calc(-1 * var(--mitra-glyph-inset));
						}

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
								margin-inline: -0.5rem;
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

							&.color {
								.content {
									gap: 0.375rem;
								}
							}
						}

					}
				}

				/* As a sheet the sheet's panel is the frame and wears the surface: the editor fills it and scrolls within. */
				> mitra-popover[data-sheet] > .editor {
					flex: 1;
					background: none;
					border: none;
					border-radius: 0;
					backdrop-filter: none;

					> ul {
						padding-block-end: max(1rem, env(safe-area-inset-bottom));
					}
				}
			}
		`
	}

	protected override get template() {
		return !this.segment ? html.nothing : html`
			<mitra-popover sheet @openChange=${this.handleOpenChange}>
				<div class="editor">
					<header>
						<div class="toolbar">
							${this.colorTemplate}
							<span class="bar">
								${this.sourceTemplate}
								<span class="spacer"></span>
								${this.entryTypeTemplate}
								${!this.hasMenu ? html.nothing : html`
									<mitra-popover-container>
										<mitra-icon-button label=${t('Options')} icon="more-horizontal"></mitra-icon-button>
										<mitra-menu slot="popover">
											${this.externalLinkTemplate}
											${!this.segment.entry.persisted || !this.capabilities.createEntries ? html.nothing : html`
												<mitra-menu-item icon="copy" @click=${this.handleDuplicate}>
													${t('Duplicate')}
													<kbd>${EntryDetailsComponent.altKey}</kbd>
													<span class="word">${t('drag')}</span>
												</mitra-menu-item>
											`}
											${!this.capabilities.deleteEntries ? html.nothing : html`
												<mitra-menu-item icon="trash-2" variant="danger" @click=${(e: MouseEvent) => void this.handleDelete(EntryDetailsComponent.bypassesScope(e))}>
													${t('Delete')}
													<kbd>${EntryDetailsComponent.appleKeyboard ? '⌫' : 'Del'}</kbd>
												</mitra-menu-item>
											`}
										</mitra-menu>
									</mitra-popover-container>
								`}
								<mitra-icon-button class="close" icon="x" label=${t('Close')}
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
			</mitra-popover>
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
	 * The popover's rows in GROUPS, empty ones dropped. A separator then rides strictly BETWEEN what
	 * remains ({@link join}), so it cannot double up, lead, or trail. That matters because what a row
	 * has to say is the PROVIDER's answer, not this template's: a Notion task has no free/busy, no
	 * visibility and no reminders, so its whole third group vanishes, and used to leave its neighbour's
	 * separator sitting against the next one.
	 *
	 * Emptiness is each row's OWN answer (`html.nothing`, which every row template already returns when
	 * its capability is off), never re-derived here, or the two would drift. The one row that cannot
	 * answer as a template is the sharing element, which decides inside itself; it exposes the same
	 * question as {@link EntryDetailsSharing.applies}.
	 *
	 * The order is the argument: everything up to reminders describes THIS entry, so relationships,
	 * which connect it to OTHERS, and whose rows grow, close the popover as their own group.
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
		const handleTypeChange = (e: CustomEvent<EntryTypeValue>) => {
			entry.type = e.detail
			EntryStore.notify()
			this.handleChange().catch(reportSaveError)
		}
		return html`
			<span class="entry-type field">
				<mitra-select label=${t('Type')} .value=${entry.type.value} @change=${handleTypeChange}>
					${EntryType.all.map(type => html`<mitra-option .value=${type.value}>${type.format()}</mitra-option>`)}
				</mitra-select>
			</span>
		`
	}

	private get sourceTemplate() {
		const handleSourceChange = (e: CustomEvent<Source>) => {
			const source = e.detail
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
				<mitra-select label=${t('Calendar')} ?disabled=${!this.capabilities.editEntries} .value=${this.source} @change=${handleSourceChange}>
					${getIntegrations()
						.map(integration => ({ integration, sources: [...integration.sources].filter(source => source.id === entry.sourceId || (source.enabled && canHold(source))) }))
						.filter(({ sources }) => sources.length)
						.map(({ integration, sources }) => html`
							<mitra-option-group label=${integration.credentials?.username || integration.type}>
								${sources.map(source => html`
									<mitra-option .value=${source} label=${source.name}>
										<mitra-source-icon .source=${source}></mitra-source-icon>
										${source.name}
									</mitra-option>
								`)}
							</mitra-option-group>
						`)}
				</mitra-select>
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
		;(e.target as HTMLElement).closest('mitra-popover')?.hide()
	}

	private get colorTemplate() {
		const entry = this.segment?.entry
		const activeColor = entry?.color || this.source?.color
		return !entry ? html.nothing : html`
			<span class="color">
				<mitra-popover-container>
					<mitra-button class="dot" label=${t('Color')} ?disabled=${!this.capabilities.editEntries}
						style="--dot: ${activeColor ?? 'var(--color-text-muted)'}"></mitra-button>
					<mitra-popover slot="popover">
						<mitra-color-picker
							.palette=${Color.palette}
							.value=${activeColor}
							.resetValue=${this.source?.color}
							resetLabel=${t('Reset to calendar color')}
							@change=${this.handleColorChange}
						></mitra-color-picker>
					</mitra-popover>
				</mitra-popover-container>
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
