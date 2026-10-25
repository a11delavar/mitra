import { component, html, join, property, state, Component, css, eventListener, event, Binder, query } from '@a11d/lit'
import { fileDrop } from '@3mo/file-upload'
import { centered, type Popover, startedInField, scrollbar } from '#design'
import { type Source, Color } from '#features/sources'
import { Calendars } from '#features/sources/client/Calendars.js'
import * as Hierarchy from '#features/relations/client/Hierarchy.js'
import { EntryType, type EntryTypeValue } from '../EntryType.js'
import { TaskStatus } from '../TaskStatus.js'
import { Transparency } from '../Transparency.js'
import type { EntrySegment } from './EntrySegment.js'
import { EntryStore, reportSaveError } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { DialogDuplicateDays } from './DialogDuplicateDays.js'
import { EntryDetailsSharing } from './EntryDetailsSharing.js'
import { editorFieldStyles } from './editorFields.css.js'
import { AttachmentsField } from './AttachmentsField.js'

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
					this.popoverElement?.show(this.closest<HTMLElement>('mitra-entry-segment, mitra-availability-segment > .window') ?? undefined)
				} else {
					this.popoverElement?.hide()
				}
			})
		},
	}) open = false

	@property({ type: Object }) segment?: EntrySegment

	readonly store = new EntryStore(this)

	protected override createRenderRoot() { return this }

	/** Its popover, which is anchored at the segment, centered where it has no room, and a sheet on a phone. */
	@query('mitra-popover') private readonly popoverElement?: Popover
	@query('.title') private readonly titleInput?: HTMLInputElement
	@query('.description textarea') private readonly descriptionTextarea?: HTMLTextAreaElement
	@query('mitra-attachments-field') private readonly attachmentsField?: AttachmentsField

	private readonly handleOpenChange = async (e: CustomEvent<boolean>) => {
		// Its segment drops it once it closes, so its exit plays out first; opened again meanwhile, it stays.
		if (!e.detail) {
			await this.popoverElement?.settle()
			if (this.popoverElement?.open) {
				return
			}
		}
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

	/** Copies the entry to each day the dialog is told, one create apiece, so a copy that fails drops alone. */
	private readonly handleDuplicateToDays = async () => {
		const entry = this.segment!.entry
		const spans = await new DialogDuplicateDays({ entry }).confirm().catch(() => undefined)
		if (!spans) {
			return
		}
		this.close()
		await Promise.all(spans.map(span => EntryStore.duplicate(entry, span)
			.catch(error => console.error('Duplicating the entry failed, so that copy was not added:', error))))
	}

	/** A date to copy along: a start, or an unscheduled task's due. Availability repeats by its rule instead. */
	private get duplicatesToDays() {
		const { entry } = this.segment!
		return (!!entry.start || !!entry.due) && !entry.type.isAvailability
	}

	private static readonly appleKeyboard = /Mac|iPhone|iPad/.test(navigator.platform)

	private static get altKey() { return EntryDetailsComponent.appleKeyboard ? '⌥' : 'Alt' }

	@eventListener({ target: window, type: 'keydown' })
	protected handleWindowKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Delete' && e.key !== 'Backspace') {
			return
		}
		if (!this.open || startedInField(e) || e.altKey || e.isComposing || !this.segment!.entry.source.capabilities.entries.delete) {
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
		const link = Calendars.externalLinkOf(this.segment!.entry)
		return !link ? html.nothing : html`
			<mitra-menu-item icon="external-link" href=${link.url} target="_blank">
				${link.label ? t('Open in ${provider}', { provider: t(link.label) }) : t('Open link')}
			</mitra-menu-item>
		`
	}

	private get hasMenu() {
		return !!Calendars.externalLinkOf(this.segment!.entry)
			|| (this.segment!.entry.persisted && this.segment!.entry.source.capabilities.entries.create)
			|| this.segment!.entry.source.capabilities.entries.delete
	}

	private readonly binder = new Binder(this, 'segment')

	private bind = (keyPath: KeyPath.Of<EntrySegment>, event = 'change') => {
		return this.binder.bind({ keyPath, event, sourceUpdated: () => EntryStore.notify() })
	}

	static override get styles() {
		return css`
			${editorFieldStyles}
			${centered}

			@keyframes mitra-editor-arrived {
				to { --mitra-editor-arrived: true; }
			}

			/* The editor hangs from a named anchor rather than the one show() gives, which hiding takes away while it
			   fades out. A segment names itself so beside its connector name (EventSegment); each keeps it to its own. */
			mitra-entry-segment, mitra-availability-segment > .window {
				anchor-scope: --mitra-entry-details;
			}

			mitra-availability-segment > .window {
				anchor-name: --mitra-entry-details;
			}

			mitra-entry-details {
				display: contents;
				cursor: default;
				color: var(--color-text);
				font-family: var(--font-family);
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
					position-anchor: --mitra-entry-details;
					position-area: inline-end span-all;
					position-visibility: anchors-visible;
					position-try-fallbacks: flip-inline, --centered;
					flex-direction: column;

					&:popover-open {
						display: flex;
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

					/* A row turning up while it is open grows into place, and the editor with it, which its rows size. Not
					   those it opens with, which arrive with it: the switch turns on once it has come in. */
					@media (prefers-reduced-motion: no-preference) {
						interpolate-size: allow-keywords;
						animation: mitra-editor-arrived 0s 0.2s both;

						@container style(--mitra-editor-arrived: true) {
							li {
								transition: block-size 0.2s cubic-bezier(0.2, 0, 0, 1), min-block-size 0.2s cubic-bezier(0.2, 0, 0, 1);
								overflow-block: clip;
								overflow-clip-margin: 2px;

								/* From nothing, under the control height a row keeps. */
								@starting-style {
									block-size: 0;
									min-block-size: 0;
								}
							}
						}
					}

					/* Files dragged over any of it (fileDrop) attach once dropped, so the row they land in shows it. Its border is
					   always there, transparent, so recoloring it never moves the row. */
					&[dragover] .attachments.field {
						border-style: dashed;
						border-color: var(--color-accent);
					}

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

							&[hidden] {
								display: none;
							}

							> .content {
								grid-column: 2 / -1;
								display: flex;
								align-items: center;
								flex-wrap: wrap;
								opacity: 0.85;
							}

							&.hyperlinks > .links {
								grid-column: 2 / -1;
								display: flex;
								flex-wrap: wrap;
								gap: 0.25rem 0.875rem;
								padding-block: calc((var(--control-height) - 2px - 1lh) / 2);
								/* Two lines of links at most, the rest scrolled to, so a long page of notes cannot push the description away. */
								max-block-size: calc(2lh + 0.25rem);
								overflow-y: auto;
								${scrollbar};
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
				<div class="editor" ${!this.takesFiles ? html.nothing : fileDrop({ multiple: true, handleDrop: files => this.attachmentsField?.upload(files) })}>
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
											${!this.segment.entry.persisted || !this.segment!.entry.source.capabilities.entries.create ? html.nothing : html`
												<mitra-menu-item icon="copy" @click=${this.handleDuplicate}>
													${t('Duplicate')}
													<kbd>${EntryDetailsComponent.altKey}</kbd>
													<span class="word">${t('drag')}</span>
												</mitra-menu-item>
												${!this.duplicatesToDays ? html.nothing : html`
													<mitra-menu-item icon="copy-plus" @click=${this.handleDuplicateToDays}>${t('Duplicate to other days…')}</mitra-menu-item>
												`}
											`}
											${!this.segment!.entry.source.capabilities.entries.delete ? html.nothing : html`
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
					?readonly=${!this.segment!.entry.source.capabilities.entries.edit || (entry.persisted && !this.segment!.entry.source.capabilities.entries.rename)}
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
			[this.locationTemplate, this.participantsTemplate, this.hyperlinksTemplate, this.attachmentsTemplate, this.descriptionTemplate],
			[
				!EntryDetailsSharing.applies(entry) ? html.nothing : html`
					<mitra-entry-details-sharing .entry=${entry} @change=${this.handleInPlaceEdit}></mitra-entry-details-sharing>
				`,
				this.remindersTemplate,
			],
			[this.segment!.entry.type.isAvailability ? html.nothing : html`<mitra-relations-field .entry=${entry}></mitra-relations-field>`],
		]
		return groups
			.map(rows => rows.filter(row => row !== html.nothing))
			.filter(rows => rows.length > 0)
	}

	private get entryTypeTemplate() {
		const entry = this.segment!.entry
		const source = this.segment?.entry.source
		// Its own type always, so a type that can't change still shows, disabled, rather than vanishing.
		const types = EntryType.all.filter(type => type === entry.type || (!!source && source.canHold(type)))
		const fixed = !this.segment!.entry.source.capabilities.entries.edit || types.length < 2 || entry.partOfSeries
		const handleTypeChange = (e: CustomEvent<EntryTypeValue>) => {
			entry.type = e.detail
			EntryStore.notify()
			// The type decides what draws the entry (a chip or availability), and the editor closes with the old one, so
			// whatever draws it next opens it again: asked once that has rendered, or the departing chip claims it. By the
			// entry itself, since converting re-creates it under a new id.
			setTimeout(() => EntryEditorIntent.openDraft(entry))
			this.handleChange().catch(reportSaveError)
		}
		return html`
			<span class="entry-type field">
				<mitra-select label=${t('Type')} ?disabled=${fixed} .value=${entry.type.value} @change=${handleTypeChange}>
					${types.map(type => html`<mitra-option .value=${type.value}>${type.format()}</mitra-option>`)}
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
		const canMoveTo = (target: Source) => {
			const capabilities = target.capabilities
			const ownership = target.ownership
			return capabilities.entries.create
				&& (!entry.type.isAvailability || capabilities.availability)
				&& (!entry.partOfSeries || ownership.holds('recurrence'))
				&& (!entry.due || ownership.holds('due'))
				&& (!entry.status || capabilities.entries.statuses.includes(entry.status))
				&& (entry.transparency !== Transparency.Free || ownership.holds('transparency'))
				&& (!entry.visibility || ownership.holds('visibility'))
				&& (!entry.attachments.length || (ownership.holds('attachments') && capabilities.entries.attach))
		}
		return !this.segment?.entry.source?.name ? html.nothing : html`
			<span class="source field">
				<mitra-select label=${t('Calendar')} ?disabled=${!this.segment!.entry.source.capabilities.entries.edit} .value=${this.segment?.entry.source} @change=${handleSourceChange}>
					${Calendars.integrations
						.map(integration => ({ integration, sources: integration.sources.filter(source => source.id === entry.sourceId || (source.enabled && canMoveTo(source))) }))
						.filter(({ sources }) => sources.length)
						.map(({ integration, sources }) => html`
							<mitra-option-group label=${integration.title}>
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
		return !this.segment!.entry.source.ownership.holds('location') ? html.nothing : html`
			<li class="location field">
				<mitra-icon icon="map-pin"></mitra-icon>
				<mitra-location-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-location-field>
			</li>
		`
	}

	private get participantsTemplate() {
		return !this.segment!.entry.source.ownership.holds('participants') || this.segment!.entry.type.isAvailability ? html.nothing : html`
			<li class="participants field">
				<mitra-icon icon="users"></mitra-icon>
				<mitra-participants-field .entry=${this.segment!.entry} @change=${this.handleChange}></mitra-participants-field>
			</li>
		`
	}

	/**
	 * The description's links, gathered above it: a reading of the text, so a link is added and removed where
	 * it is written. The row is always there, hidden while the description holds none: a row inserted before
	 * the description would make lit rebuild the textarea being typed in.
	 */
	private get hyperlinksTemplate() {
		const links = this.segment!.entry.links
		return !this.segment!.entry.source.ownership.holds('description') ? html.nothing : html`
			<li class="hyperlinks field" ?hidden=${!links.length}>
				<mitra-icon icon="link-2"></mitra-icon>
				<span class="links">
					${links.map(link => html`<mitra-link plain href=${link.href}>${link.words || html.nothing}</mitra-link>`)}
				</span>
			</li>
		`
	}

	/** Whether a file can be attached here, by the row's button or dropped anywhere on the editor. */
	private get takesFiles() {
		return this.segment!.entry.source.ownership.holds('attachments') && !this.segment!.entry.type.isAvailability && this.segment!.entry.source.capabilities.entries.attach && AttachmentsField.uploads
	}

	private get attachmentsTemplate() {
		const entry = this.segment!.entry
		// A calendar that can't take new files still shows the ones it has; only the controls go away.
		return !this.segment!.entry.source.ownership.holds('attachments') || this.segment!.entry.type.isAvailability || (!entry.attachments.length && !this.takesFiles) ? html.nothing : html`
			<li class="attachments field">
				<mitra-icon icon="paperclip"></mitra-icon>
				<mitra-attachments-field .entry=${entry} @change=${this.handleChange}></mitra-attachments-field>
			</li>
		`
	}

	private readonly handleColorChange = (e: CustomEvent<string | null>) => {
		this.setColor(Color.parse(e.detail) ?? null)
		;(e.target as HTMLElement).closest('mitra-popover')?.hide()
	}

	private get colorTemplate() {
		const entry = this.segment?.entry
		const activeColor = entry?.effectiveColor
		return !entry ? html.nothing : html`
			<span class="color">
				<mitra-popover-container>
					<mitra-button class="dot" label=${t('Color')} ?disabled=${!this.segment!.entry.source.capabilities.entries.edit}
						style="--dot: ${activeColor ?? 'var(--color-text-muted)'}"></mitra-button>
					<mitra-popover slot="popover">
						<mitra-color-picker
							.palette=${Color.palette.map(String)}
							.value=${activeColor?.value}
							.resetValue=${this.segment?.entry.source?.color?.value}
							resetLabel=${t('Reset to calendar color')}
							@change=${this.handleColorChange}
						></mitra-color-picker>
					</mitra-popover>
				</mitra-popover-container>
			</span>
		`
	}

	private setColor(color: Color | null) {
		if (!this.segment) {
			return
		}

		if (color === this.segment?.entry.source?.color) {
			color = null
		}

		this.segment.entry.color = color ?? undefined
		EntryStore.notify()
		this.handleChange().catch(() => void 0)
	}

	private get remindersTemplate() {
		return !this.segment!.entry.reminderAnchor || !this.segment!.entry.source.ownership.holds('reminders') || this.segment!.entry.type.isAvailability ? html.nothing : html`
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
			if (!this.segment!.entry.source.capabilities.entries.edit || e.composedPath().some(node => node instanceof HTMLAnchorElement || node instanceof HTMLInputElement)) {
				return
			}
			this.editingDescription = true
			this.updateComplete.then(() => {
				const textarea = this.descriptionTextarea
				textarea?.focus()
				textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
			})
		}
		return !this.segment!.entry.source.ownership.holds('description') ? html.nothing : html`
			<li class="description field">
				<mitra-icon icon="align-left"></mitra-icon>
				${this.editingDescription ? html`
					<textarea rows="1" placeholder=${t('Description')}
						${this.bind('entry.description', 'input')}
						@change=${this.handleChange}
						@blur=${() => this.editingDescription = false}
					></textarea>
				` : html`
					<div class="rendered" tabindex=${this.segment!.entry.source.capabilities.entries.edit ? '0' : '-1'} @focus=${editDescription} @click=${editDescription}>
						${!this.segment!.entry.description ? html`
							<div class="placeholder">${t('Description')}</div>
							` : html`
								<mitra-markdown .value=${this.segment!.entry.description}
									?interactive=${this.segment!.entry.source.capabilities.entries.edit}
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
