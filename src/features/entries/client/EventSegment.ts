import { component, html, property, Component, css, state, bind, queryConnectedInstances, eventListener, unsafeCSS } from '@a11d/lit'
import { TaskStatus } from '../Entry.js'
import { type EntrySegment } from './EntrySegment.js'
import { type RoutineRun } from '../../routines/client/Routines.js'
import { contrastColor } from '../../../design/contrastColor.js'
import { getSource, getCapabilities } from '../../../infrastructure/http/Api.js'
import { EntryStore, reportSaveError } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'

@component('mitra-entry-segment')
export class EntrySegmentComponent extends Component {
	@queryConnectedInstances() private static readonly instances: Set<EntrySegmentComponent>

	readonly store = new EntryStore(this)

	@property({ type: Object }) segment?: EntrySegment

	private get anchorName() {
		return `--mitra-entry-segment-${this.segment?.id}`
	}

	@state({
		updated(this: EntrySegmentComponent, open: boolean, wasOpen: boolean) {
			EntrySegmentComponent.instances.forEach(i => {
				if (i.segment?.entry.id === this.segment?.entry.id) {
					i.selected = open
				}
			})
			const entry = this.segment?.entry
			if (entry) {
				EntryEditorIntent.setEditing(entry, open)
			}
			if (wasOpen && !open && entry && !entry.persisted && !entry.heading?.trim()) {
				EntryStore.discardDraft()
			}
		}
	}) open = false

	@property({ type: Boolean, reflect: true }) selected = false

	@property({ type: Object }) routine?: RoutineRun
	@property({ type: Array }) ticks?: ReadonlyArray<number>
	@property() resize?: 'block' | 'inline'

	@eventListener('click')
	protected handleClick(e: MouseEvent) {
		e.stopPropagation()
		this.open = true
	}

	protected override disconnected() {
		const entry = this.segment?.entry
		if (this.open && entry) {
			EntryEditorIntent.setEditing(entry, false)
		}
	}

	private readonly handleStatusChange = () => {
		EntryStore.notify()
		const entry = this.segment?.entry
		if (entry?.persisted) {
			EntryStore.commit(entry).catch(reportSaveError)
		}
	}

	protected override updated(changed: Map<PropertyKey, unknown>) {
		super.updated?.(changed)
		const entry = this.segment?.entry
		if (!entry) {
			return
		}
		this.style.anchorName = this.anchorName
		this.toggleAttribute('data-draft', !entry.persisted)
		this.toggleAttribute('data-routine', !!this.routine)
		this.title = !this.routine ? '' : [entry.heading, entry.recurrence?.describe(entry.seriesStart)].filter(Boolean).join(' · ')
		this.toggleAttribute('dragging', this.store.isDragging(entry) || this.store.isPreview(entry))
		this.toggleAttribute('drag-source', this.store.isDragSource(entry))
		if (entry.type.isTask) {
			this.setAttribute('data-status', entry.status ?? 'todo')
			const progress = entry.progress
			if (progress !== undefined) {
				this.setAttribute('data-progress', '')
				this.style.setProperty('--mitra-entry-progress', `${Math.round(progress * 100)}%`)
			} else {
				this.removeAttribute('data-progress')
				this.style.removeProperty('--mitra-entry-progress')
			}
		} else {
			this.removeAttribute('data-status')
			this.removeAttribute('data-progress')
			this.style.removeProperty('--mitra-entry-progress')
		}
		if (EntryEditorIntent.shouldOpen(entry) && !this.segment!.hasPrevious) {
			EntryEditorIntent.setEditing(entry, true)
			EntryEditorIntent.consume()
			this.open = true
		}
	}

	static override get styles() {
		return css`
			mitra-entry-segment {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding: 0.125rem;
				--color-accent: var(--mitra-entry-segment-color);
				--mitra-entry-surface: color-mix(in srgb, color-mix(in srgb, var(--mitra-entry-segment-color) 7.5%, var(--color-surface)) 80%, transparent);
				--segment-bg: color-mix(in srgb, var(--mitra-entry-segment-color) 25%, var(--color-background));
				background-color: var(--segment-bg);
				border-inline-start: 3px solid var(--mitra-entry-segment-color);
				border-radius: var(--border-radius);
				color: color-mix(in srgb, var(--mitra-entry-segment-color) 60%, var(--color-text));
				font-size: 0.7rem;
				margin-top: 1px;
				min-height: 0;

				--overlap-s: var(--overlap-slot, 0);
				--overlap-t: var(--overlap-total, 1);
				--overlap-sp: var(--overlap-span, 1);
				--overlap-i: var(--overlap-inset, 0);
				--overlap-indent: calc(var(--overlap-i) * 0.75rem);

				margin-inline-start: calc((var(--overlap-s) / var(--overlap-t)) * 100% + var(--overlap-indent));
				width: min(calc((var(--overlap-sp) / var(--overlap-t)) * 100% + 0.25rem - var(--overlap-indent)), calc(100% - (var(--overlap-s) / var(--overlap-t)) * 100% - var(--overlap-indent) - var(--_edge-gutter, 0px)));
				z-index: calc(var(--overlap-s) + 1 + var(--overlap-i));
				box-sizing: border-box;
				container-type: size;
				position: relative;
				overflow: clip;
				overflow-clip-margin: border-box;
				transition: background-color 0.15s ease, color 0.15s ease;

				&[data-covers] {
					--segment-bg: color-mix(in srgb, var(--mitra-entry-segment-color) 38%, color-mix(in srgb, var(--color-background) 55%, transparent));
					background-color: var(--segment-bg);
					backdrop-filter: blur(6px) saturate(130%);
					box-shadow: 0 2px 8px rgb(0 0 0 / 0.18);
				}

				&[dragging] {
					z-index: 9999;
					--overlap-s: 0;
					--overlap-t: 1;
					--overlap-sp: 1;
					--overlap-i: 0;
				}

				&[drag-source] {
					opacity: 0.4;
				}

				> .resize-start, > .resize-end {
					position: absolute;
					z-index: 3;
				}

				&[resize=block] {
					> .resize-start, > .resize-end {
						inset-inline: 0;
						block-size: min(0.25rem, 30%);
						cursor: ns-resize;
					}
					> .resize-start { inset-block-start: 0; }
					> .resize-end { inset-block-end: 0; }
				}

				&[resize=inline] {
					> .resize-start, > .resize-end {
						inset-block: 0;
						inline-size: 0.25rem;
						cursor: ew-resize;
					}
					> .resize-start { inset-inline-start: 0; }
					> .resize-end { inset-inline-end: 0; }
				}

				&[has-previous] > .resize-start { display: none; }
				&[has-next] > .resize-end { display: none; }

				@container (max-height: 1.5rem) {
					&[resize=block] > .resize-start, &[resize=block] > .resize-end { display: none; }
				}

				&:not([data-draft]):has([popover]:popover-open),
				&:not([data-draft])[selected],
				&[data-connect=target] {
					--segment-bg: var(--mitra-entry-segment-color);
					background-color: var(--segment-bg);
					color: ${contrastColor('var(--mitra-entry-segment-color)')};
				}

				&[data-connect=reject] {
					cursor: not-allowed;
				}

				@container (max-height: 450px) {
					flex-direction: row;
					align-items: center;
					gap: 0.25rem;
					padding: 0 0.375rem;
				}

				&[data-draft] {
					border: 2px dashed var(--mitra-entry-segment-color);
					background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 15%, transparent);
					color: var(--mitra-entry-segment-color);
				}

				&[has-next] {
					border-end-start-radius: 0;
					border-end-end-radius: 0;
					padding-bottom: 0;

					@container (max-height: 450px) {
						border-start-end-radius: 0;
						border-end-end-radius: 0;
						border-bottom: none;
						margin-inline-end: -0.25rem;
						padding-inline-end: 0.5rem;
					}
				}

				&[has-previous] {
					border-start-start-radius: 0;
					border-start-end-radius: 0;
					padding-top: 0;

					@container (max-height: 450px) {
						border-start-start-radius: 0;
						border-end-start-radius: 0;
						border-top: none;
						margin-inline-start: -0.25rem;
						padding-inline-start: 0.5rem;
					}
				}

				& > .heading {
					font-weight: 600;
					white-space: normal;
					word-break: break-word;
					line-height: 1.1;
					display: flex;
					flex-direction: column;

					--header-line: 0.8125rem;
					--header-mark: 0.8125rem;

					@media (pointer: coarse) {
						--header-line: 0.9375rem;
						--header-mark: 0.9375rem;
					}

					> .header {
						display: flex;
						align-items: center;
						min-width: 0;

						> mitra-task-status {
							flex-shrink: 0;
							block-size: var(--header-line);
							inline-size: var(--header-line);
							margin-inline-end: 0.25rem;
							align-items: center;
							justify-content: center;
							vertical-align: middle;

							> :is(button, mitra-icon-button) {
								font-size: var(--header-mark);
								block-size: 100%;
								inline-size: 100%;
								--icon-button-size: 0;
							}

							@container (max-width: 3.5rem) and (max-height: 2rem) {
								display: none;
							}
						}

						> .time {
							opacity: 0.75;
							font-size: 0.65rem;
							white-space: nowrap;
							margin-inline-end: 0.25rem;
							overflow: clip;

							@container (max-height: 2rem) and (max-width: 7rem) {
								display: none;
							}

							> .separator, > .end {
								@container (max-height: 2rem) {
									display: none;
								}
							}
						}
					}

					> .label {
						min-width: 0;
					}

					@container (max-height: 2rem) {
						display: block;
						min-width: 0;
						--header-line: 0.875rem;
						--header-mark: 0.875rem;
						margin-block: auto;

						> .header {
							display: contents;

							> mitra-task-status {
								vertical-align: -0.125em;
							}
						}
					}

					@container (max-height: 1rem) {
						white-space: nowrap;
					}

					@container (max-height: 0.5rem) {
						display: none;
					}
				}

				&:not(:has(> .heading > .header > .time)) > .heading {
					display: block;
					min-width: 0;
					--header-line: 0.875rem;
					--header-mark: 0.875rem;

					> .header {
						display: contents;

						> mitra-task-status {
							vertical-align: -0.125em;
						}
					}
				}

				&[data-status=${unsafeCSS(TaskStatus.Done)}], &[data-status=${unsafeCSS(TaskStatus.Cancelled)}] {
					& > .heading > .label {
						opacity: 0.6;
						text-decoration: line-through;
					}
				}

				& > .location {
					display: flex;
					align-items: center;
					gap: 0.2rem;
					opacity: 0.75;
					font-size: 0.65rem;
					line-height: 1.1;
					min-width: 0;

					> mitra-icon {
						font-size: 0.75rem;
						flex-shrink: 0;
					}

					> .label {
						text-overflow: ellipsis;
						overflow: hidden;
					}

					@container (height < 3rem) {
						display: none;
					}

					@container (max-height: 4.5rem) {
						> .label {
							min-width: 0;
							white-space: nowrap;
						}
					}
				}

				& > .recurring {
					position: absolute;
					inset-block-start: 0.25rem;
					inset-inline-end: 0.375rem;
					font-size: 0.85rem;
					opacity: 0.6;
					pointer-events: none;

					@container (max-height: 0.5rem) {
						display: none;
					}
				}

				&:has(> .recurring) > .heading > .header {
					padding-inline-end: 1.35rem;
				}

				@container (max-height: 2rem) {
					&:has(> .recurring) > .heading {
						padding-inline-end: 1.35rem;
					}
				}

				&[data-routine] {
					display: grid;
					grid-template-columns: subgrid;
					grid-template-rows: 100%;
					align-items: center;
					background: none;
					border-inline-start: none;
					border-radius: 0;
					block-size: 0.125rem;
					align-self: center;
					inline-size: auto;
					margin-inline: 0;
					padding: 0;
					margin-top: 0;
					overflow: visible;

					> .heading, > .location, > .recurring, > .resize-start, > .resize-end {
						display: none;
					}

					> .mark {
						block-size: 100%;
						border-radius: 999px;
						margin-inline: 2.5%;
						background-color: color-mix(in srgb, var(--mitra-entry-segment-color) 60%, transparent);
					}

					&::after {
						content: '';
						position: absolute;
						inset-block: -1px;
						inset-inline: 0;
					}

					&:is(:hover, [selected]) > .mark {
						background-color: var(--mitra-entry-segment-color);
					}
				}

				@container (max-width: 6rem) {
					& > .recurring {
						display: none;
					}

					&:has(> .recurring) > .heading,
					&:has(> .recurring) > .heading > .header {
						padding-inline-end: 0;
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		if (!this.segment) return html.nothing

		this.style.setProperty(
			'--mitra-entry-segment-color',
			this.segment.entry.color ?? getSource(this.segment.entry.sourceId)?.color ?? ''
		)

		const showsTime = !this.segment.allDay && this.segment.entry.scheduled
		if (this.routine) {
			return html`
				${this.ticks?.map(column => html`<i class="mark" style="grid-column: ${column};"></i>`)}
				${this.detailsTemplate}
			`
		}
		return html`
			<div class="heading">
				${!this.segment.entry.type.isTask && !showsTime ? html.nothing : html`
					<div class="header">
						${!this.segment.entry.type.isTask ? html.nothing : html`
							<mitra-task-status .entry=${this.segment.entry} @change=${this.handleStatusChange}></mitra-task-status>
						`}
						${!showsTime ? html.nothing : html`
							<span class="time">
								<span class="start">${this.segment.entry.start?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
								<span class="separator">-</span>
								<span class="end">${this.segment.entry.end?.format({ hour: '2-digit', minute: '2-digit', hour12: false })}</span>
							</span>
						`}
					</div>
				`}
				<span class="label">${this.segment.entry.heading || (this.segment.entry.persisted ? '' : t('Draft'))}</span>
			</div>
			${this.segment.allDay || !this.segment.entry.location ? html.nothing : html`
				<div class="location">
					<span class="label">${this.segment.entry.location}</span>
				</div>
			`}
			${!this.segment.entry.partOfSeries ? html.nothing : html`
				<mitra-icon class="recurring" icon="repeat" title=${t('Repeats')}></mitra-icon>
			`}
			${!this.resize || !this.segment.entry.persisted || !getCapabilities(this.segment.entry.sourceId).editEntries ? html.nothing : html`
				<div class="resize-start"></div>
				<div class="resize-end"></div>
			`}
			${this.detailsTemplate}
		`
	}

	private get detailsTemplate() {
		return !this.open ? html.nothing : html`
			<mitra-entry-details popover data-sheet ?open=${bind(this, 'open')}
				style="--mitra-sheet-anchor: ${this.anchorName}"
				.segment=${this.segment}
				@click=${(e: Event) => e.stopPropagation()}
			></mitra-entry-details>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-segment': EntrySegmentComponent
	}
}
