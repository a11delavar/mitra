import { component, html, property, Component, css, state, bind, queryConnectedInstances, eventListener, unsafeCSS, guard } from '@a11d/lit'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import { TaskStatus } from '../TaskStatus.js'
import { type EntrySegment } from './EntrySegment.js'
import { EntrySegments } from './EntrySegments.js'
import { type RoutineRun } from '../../routines/client/Routines.js'
import { contrastColorOf } from '../../../design/contrastColor.js'
import { MarkdownLinks } from '../../../design/MarkdownLinks.js'
import { Link } from '../../../design/Link.js'
import { Calendars } from '../../sources/client/Calendars.js'
import { EntryStore, reportSaveError } from './EntryStore.js'
import { EntryEditorAnchor } from './EntryEditorAnchor.js'
import { entryColors } from './entryColors.css.js'

@component('mitra-entry-segment')
export class EntrySegmentComponent extends Component {
	@queryConnectedInstances() private static readonly instances: Set<EntrySegmentComponent>

	readonly store = new EntryStore(this, { entry: () => this.segment?.entry })
	readonly editor = new EntryEditorAnchor(this)

	@property({ type: Object }) segment?: EntrySegment

	private get anchorName() {
		return `--mitra-entry-segment-${this.segment?.id}`
	}

	@state({
		updated(this: EntrySegmentComponent, open: boolean, wasOpen: boolean) {
			const segment = this.segment
			const entry = segment?.entry
			// A segment mounts closed and lit counts that initial value as a change, so only a real
			// transition may speak for the entry: otherwise a second segment of one already open,
			// another day of its run, would retract the editor as it arrives.
			if (!segment || !entry || (!open && !wasOpen)) {
				return
			}
			const identity = EntryStore.identityOf(segment.occurrence)
			EntrySegmentComponent.instances.forEach(i => {
				if (i.segment && EntryStore.identityOf(i.segment.occurrence) === identity) {
					i.selected = open
				}
			})
			if (!open && !entry.persisted && !entry.heading?.trim()) {
				EntryStore.discardDraft()
			}
		},
	}) open = false

	@property({ type: Boolean, reflect: true }) selected = false

	/** Draws the entry's day too, for chips listed where no column supplies the date. */
	@property({ type: Boolean }) dated = false

	@property({ type: Object }) routine?: RoutineRun
	@property({ type: Array }) ticks?: ReadonlyArray<number>
	@property() resize?: 'block' | 'inline'

	@eventListener('click')
	protected handleClick(e: MouseEvent) {
		e.stopPropagation()
		this.claim()
		this.open = true
	}

	/**
	 * Before anything edits a date its rule yields, an override takes the date over, so the edit never reaches the
	 * recurring entry. The chip shows the override's day from then on.
	 */
	private claim() {
		const segment = this.segment
		if (!segment || segment.entry !== segment.occurrence.recurringEntry) {
			return
		}
		const entry = EntryStore.editable(segment.occurrence)
		const occurrence = EntryStore.occurrences.find(occurrence => occurrence.entry === entry)
		const days = occurrence ? EntrySegments.for(occurrence) : []
		this.segment = days.find(day => day.dayValue === segment.dayValue) ?? days[0] ?? segment
	}

	protected override willUpdate(changed: Map<PropertyKey, unknown>) {
		super.willUpdate?.(changed)
		if (changed.has('open') && this.open) {
			this.claim()
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
		const recurring = this.segment!.occurrence.recurringEntry ?? entry
		this.title = !this.routine ? '' : [entry.heading, recurring.recurrence?.describe(recurring.start ?? recurring.due)].filter(Boolean).join(' · ')
		this.toggleAttribute('dragging', this.store.isDragging(entry) || this.store.isPreview(entry))
		this.toggleAttribute('drag-source', this.store.isDragSource(entry))
		if (entry.type.isTask) {
			this.setAttribute('data-status', (entry.status ?? TaskStatus.ToDo).code)
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
	}

	static override get styles() {
		return css`
			mitra-entry-segment {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding: 0.125rem;
				${entryColors};
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
					${contrastColorOf('color', 'var(--mitra-entry-segment-color)')};
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
					min-width: 0;

					--header-line: 0.8125rem;
					--header-mark: 0.8125rem;

					@media (pointer: coarse) {
						--header-line: 0.9375rem;
						--header-mark: 0.9375rem;
					}

					/* A meta row above the label, or one centred line. The triggers set --inline empty to
					   pick the line, or to initial so each pair below falls back to the stacked value. */
					--inline: initial;

					&:not([data-meta]) {
						--inline: ;
						--header-line: 0.875rem;
						--header-mark: 0.875rem;
					}

					/* Only a chip too short for a meta row centres its line; a tall one without a meta row keeps it at the top. */
					@container (max-height: 2rem) {
						--inline: ;
						--header-line: 0.875rem;
						--header-mark: 0.875rem;
						margin-block: auto;
					}

					display: flex;
					--_direction: var(--inline) row;
					flex-direction: var(--_direction, column);
					--_align: var(--inline) center;
					align-items: var(--_align, stretch);

					> .header {
						--_header-display: var(--inline) contents;
						display: var(--_header-display, flex);
						align-items: center;
						min-width: 0;

						> mitra-task-status {
							flex-shrink: 0;
							block-size: var(--header-line);
							inline-size: var(--header-line);
							margin-inline-end: 0.25rem;
							align-items: center;
							justify-content: center;

							> button {
								font-size: var(--header-mark);
								block-size: 100%;
								inline-size: 100%;
							}

							@container (max-width: 3.5rem) and (max-height: 2rem) {
								display: none;
							}
						}

						> :is(.due, .recurring) {
							flex-shrink: 0;
							font-size: 0.65rem;
							opacity: 0.75;
							margin-inline-end: 0.25rem;

							@container (max-height: 2rem) and (max-width: 7rem) {
								display: none;
							}
						}

						> .when {
							opacity: 0.75;
							font-size: 0.65rem;
							white-space: nowrap;
							margin-inline-end: 0.25rem;
							overflow: clip;

							/* One line has room for the start, not the span. */
							--_range-display: var(--inline) none;
							--_point-display: var(--inline) inline;
							&.range { display: var(--_range-display, inline); }
							&.point { display: var(--_point-display, none); }

							@container (max-height: 2rem) and (max-width: 7rem) {
								&.range, &.point {
									display: none;
								}
							}
						}
					}

					> .label {
						min-width: 0;
					}

					@container (max-height: 1rem) {
						white-space: nowrap;
					}

					@container (max-height: 0.5rem) {
						display: none;
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

					> .heading, > .location, > .resize-start, > .resize-end {
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
			}
		`
	}

	protected override createRenderRoot() { return this }

	private get timed() {
		return !this.segment!.allDay && this.segment!.occurrence.scheduled
	}

	private get showsDate() {
		return this.dated && !!this.segment!.occurrence.lastDay
	}

	/** Which fields the when-line carries: the day only when this chip has to say which one. */
	private get whenOptions(): Intl.DateTimeFormatOptions {
		const day = this.segment!.occurrence.lastDay
		return {
			...!this.showsDate ? {} : { day: 'numeric', month: 'short', ...day!.year === new DateTime().year ? {} : { year: 'numeric' as const } },
			...!this.timed ? {} : { hour: 'numeric', minute: '2-digit' },
		}
	}

	private get dueLabel() {
		const { occurrence } = this.segment!
		return occurrence.due!.format(occurrence.allDay
			? { weekday: 'short', day: 'numeric', month: 'short' }
			: { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
	}

	/** What the entry spans: its hours when it has them, otherwise the days it occupies. */
	private get whenSpan() {
		const { occurrence } = this.segment!
		return this.timed
			? new DateTimeRange(occurrence.start, occurrence.effectiveEnd)
			: new DateTimeRange(occurrence.start?.dayStart ?? occurrence.lastDay, occurrence.lastDay)
	}

	/** Formatted again only once it reads differently: every store notification renders every chip, and Intl's range formatting dominates that. */
	private get whenTemplate() {
		const span = this.whenSpan
		const options = this.whenOptions
		return guard([span.start?.valueOf(), span.end?.valueOf(), span.timeZoneId, span.calendarId, String(Localizer.locales.current), JSON.stringify(options)], () => html`
			<span class="when range">${span.format(options)}</span>
			<span class="when point">${span.start?.format(options)}</span>
		`)
	}

	/** A location that is a link says where it leads ("Join Zoom"), not its address. */
	private get locationTemplate() {
		const { location } = this.segment!.entry
		const link = MarkdownLinks.sole(location)
		const appearance = link ? Link.appearanceOf(new URL(link)) : undefined
		return html`
			<div class="location">
				${!appearance ? html.nothing : html`<mitra-icon icon=${appearance.icon}></mitra-icon>`}
				<span class="label">${appearance?.label ?? location}</span>
			</div>
		`
	}

	protected override get template() {
		if (!this.segment) return html.nothing

		this.style.setProperty(
			'--mitra-entry-segment-color',
			this.segment.entry.color ?? Calendars.source(this.segment.entry.sourceId)?.color ?? '',
		)

		const meta = this.timed || this.showsDate
		if (this.routine) {
			return html`
				${this.ticks?.map(column => html`<i class="mark" style="grid-column: ${column};"></i>`)}
				${this.detailsTemplate}
			`
		}
		const repeats = this.segment.occurrence.recurring || this.segment.entry.partOfSeries
		return html`
			<div class="heading" ?data-meta=${meta}>
				${!this.segment.entry.type.isTask && !meta && !repeats ? html.nothing : html`
					<div class="header">
						${!this.segment.entry.type.isTask ? html.nothing : html`
							<mitra-task-status .entry=${this.segment.entry} @pointerdown=${() => this.claim()} @keydown=${() => this.claim()} @change=${this.handleStatusChange}></mitra-task-status>
						`}
						${!meta ? html.nothing : this.whenTemplate}
						${!repeats ? html.nothing : html`<mitra-icon class="recurring" icon="repeat" title=${t('Repeats')}></mitra-icon>`}
						${!this.segment.occurrence.due ? html.nothing : html`
							<mitra-icon class="due" icon="flag" title=${t('Due ${date}', { date: this.dueLabel })}></mitra-icon>
						`}
					</div>
				`}
				<span class="label">${this.segment.entry.heading || (this.segment.entry.persisted ? '' : t('Draft'))}</span>
			</div>
			${this.segment.allDay || !this.segment.entry.location ? html.nothing : this.locationTemplate}
			${!this.resize || !this.segment.entry.persisted || !Calendars.capabilitiesOf(this.segment.entry.sourceId).entries.edit ? html.nothing : html`
				<div class="resize-start"></div>
				<div class="resize-end"></div>
			`}
			${this.detailsTemplate}
		`
	}

	private get detailsTemplate() {
		return !this.open ? html.nothing : html`
			<mitra-entry-details ?open=${bind(this, 'open')}
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
