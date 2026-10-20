import { Component, component, html, css, repeat, unsafeCSS, eventListener } from '@a11d/lit'
import { ReorderabilityController, ReorderabilityState } from '@3mo/reorderability'
import type { Source } from '#features/sources'
import { EntryType, Entry, EntryRank } from '#features/entries'
import { Calendars } from '#features/sources/client/Calendars.js'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'
import { EntrySegments } from '#features/entries/client/EntrySegments.js'
import { EntryDragController } from '#features/entries/client/EntryDragController.js'
import { HideDoneTasksSetting } from '#features/entries/client/HideDoneTasksSetting.js'
import type { EntryOccurrence } from '#features/recurrence'
import type { EntrySegmentComponent } from '#features/entries/client/EventSegment.js'

/**
 * The two lists of tasks awaiting a decision: the ones whose day has passed, and the ones that never
 * got a day. Neither is bounded by the window the calendar is showing.
 */
@component('mitra-planning')
export class Planning extends Component {
	readonly store = new EntryStore(this)
	private readonly reorder = new ReorderabilityController(this, { handleReorder: (from, to) => this.commitReorder(from, to) })

	/** The unscheduled chip a reorder has hold of, so the gesture can carry on as a scheduling drag. */
	private held?: { occurrence: EntryOccurrence, segment: EntrySegmentComponent, bounds: DOMRect }

	/**
	 * Open tasks whose day has gone by, most overdue first. A drag's ghost belongs to the grid it is
	 * being dropped on: nothing is dropped into this list, so a preview that happens to be overdue
	 * too would only read as a second copy of the entry already here.
	 */
	static get overdue(): ReadonlyArray<EntryOccurrence> {
		return EntryStore.occurrences
			.filter(occurrence => occurrence.overdue && !EntryStore.previewing(occurrence.entry))
			.sort((a, b) => a.lastDay!.valueOf() - b.lastDay!.valueOf())
	}

	/** Visible unscheduled tasks matching current lens filters: open before finished, in the manual order,
	 * with tasks not placed yet after the placed ones, the soonest due first, then by title. */
	static get unscheduled(): ReadonlyArray<EntryOccurrence> {
		return HideDoneTasksSetting.filter(EntryStore.occurrences)
			.filter(occurrence => !occurrence.scheduled)
			.sort((a, b) => Number(a.entry.closed) - Number(b.entry.closed)
				|| EntryRank.compare(a.entry.rank, b.entry.rank)
				|| (a.due?.valueOf() ?? Infinity) - (b.due?.valueOf() ?? Infinity)
				|| (a.entry.heading || '').localeCompare(b.entry.heading || ''))
	}

	/** What the tab badge counts: everything either list is asking the user to decide about. */
	static get pending() {
		return Planning.overdue.length + Planning.unscheduled.length
	}

	private static reorderable({ entry }: EntryOccurrence) {
		return !entry.closed && entry.persisted
	}

	private static get target(): Source | undefined {
		return Calendars.primary(EntryType.Task)
	}

	static get canAdd() {
		return !!Planning.target
	}

	static add() {
		const source = Planning.target
		if (!source) {
			return
		}
		const draft = new Entry({ sourceId: source.id, type: EntryType.Task, heading: '' })
		EntryStore.upsertDraft(draft)
		EntryEditorIntent.openDraft(draft)
	}

	private readonly handlePointerDown = (e: PointerEvent) => {
		if (e.button !== 0) {
			return
		}
		const target = e.target as HTMLElement
		if (target.closest('mitra-entry-details') || target.closest('mitra-task-status')) {
			return
		}
		const segment = target.closest('mitra-entry-segment') as EntrySegmentComponent | null
		const occurrence = segment?.segment?.occurrence
		this.held = undefined
		if (!segment || !occurrence?.entry.persisted) {
			return
		}
		// Closed tasks, overdue ones, and a list too short to reorder go straight to scheduling.
		const section = (e.currentTarget as HTMLElement).closest('section')!
		if (section.classList.contains('unscheduled') && Planning.reorderable(occurrence) && Planning.unscheduled.filter(Planning.reorderable).length >= 2) {
			this.held = { occurrence, segment, bounds: section.getBoundingClientRect() }
			return
		}
		EntryDragController.beginExternal(EntryStore.editable(occurrence), segment, this, e)
	}

	/** `from` and `to` index into {@link unscheduled}. */
	private commitReorder(from: number, to: number) {
		const occurrences = Planning.unscheduled
		const moved = occurrences[from]
		if (!moved || from === to) {
			return
		}
		const rest = occurrences.filter(occurrence => occurrence !== moved)
		const anchor = (occurrence: EntryOccurrence | undefined) => occurrence && Planning.reorderable(occurrence) ? occurrence.entry : undefined
		void EntryStore.reorder(occurrences.filter(Planning.reorderable).map(occurrence => occurrence.entry), moved.entry, anchor(rest[to - 1]), anchor(rest[to]))
	}

	/** How far (px) a reorder may stray outside the list before it becomes a scheduling drag. */
	private static readonly handOffSlack = 16

	@eventListener('pointermove')
	protected handlePointerMove(e: PointerEvent) {
		const held = this.held
		if (!held || !this.hasAttribute('data-reordering') || Planning.near(held.bounds, e)) {
			return
		}
		this.held = undefined
		this.reorder.abandon()
		EntryDragController.beginExternal(EntryStore.editable(held.occurrence), held.segment, this, e, { held: true })
	}

	private static near(bounds: DOMRect, e: PointerEvent) {
		const slack = Planning.handOffSlack
		return e.clientX >= bounds.left - slack && e.clientX <= bounds.right + slack
			&& e.clientY >= bounds.top - slack && e.clientY <= bounds.bottom + slack
	}

	/** Brings `entry`'s row into view once the list has it, so its editor has somewhere to open from. */
	async reveal(entry: Entry) {
		await this.updateComplete
		const row = [...this.querySelectorAll('mitra-entry-segment')].find(segment => segment.segment?.entry === entry || (entry.id !== undefined && segment.segment?.occurrence.key === entry.id))
		row?.scrollIntoView({ block: 'nearest' })
	}

	static override get styles() {
		return css`
			mitra-planning {
				display: flex;
				flex-direction: column;
				min-block-size: 0;
				gap: 1.25rem;

				/* The backlog never takes the whole column: the list below is also the unschedule
				   drop target, which has to stay worth aiming at. */
				> .overdue {
					flex: 0 1 auto;
					max-block-size: 50%;
				}

				> .unscheduled {
					flex: 1;
				}

				> section {
					display: flex;
					flex-direction: column;
					min-block-size: 0;
					gap: 0.5rem;
				}

				/* Child combinators throughout: an entry's editor opens inside these lists, with a header and rows of its own. */
				> section > header {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					flex-shrink: 0;
					font-size: 0.75rem;
					font-weight: 600;
					color: var(--color-text-muted);

					> h2 {
						margin: 0;
						padding: 0;
						flex: 1;
						min-width: 0;
						font: inherit;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
					}

					> .count {
						font-variant-numeric: tabular-nums;
					}
				}

				> section > .entries {
					display: flex;
					flex-direction: column;
					gap: 0.25rem;
					overflow-y: auto;
					flex: 1;
					min-block-size: 0;

					> ul {
						list-style: none;
						margin: 0;
						padding: 0;
						display: flex;
						flex-direction: column;
						gap: 0.25rem;
					}

					> ul > li {
						flex-shrink: 0;
						display: flex;
					}

					> ul > li > mitra-entry-segment {
						inline-size: 100%;
						cursor: grab;
						padding-block: 0.25rem;
						container-type: inline-size;
					}

					> ul > li[data-reorderability=${unsafeCSS(ReorderabilityState.Dragging)}] {
						z-index: 5;

						> mitra-entry-segment {
							cursor: grabbing;
							box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.25);
						}
					}
				}

				&[data-reordering] > .unscheduled > .entries > ul > li:not([data-reorderability=${unsafeCSS(ReorderabilityState.Dragging)}]) {
					transition: transform 0.15s ease;
				}

				> section > .empty {
					flex: 1;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					gap: 0.5rem;
					padding: 1.5rem 1rem;
					text-align: center;
					color: var(--color-text-muted);
					font-size: 0.8rem;
					line-height: 1.4;

					> mitra-icon {
						font-size: 1.5rem;
						opacity: 0.5;
					}
				}
			}
		`
	}

	protected override createRenderRoot() { return this }

	protected override get template() {
		const overdue = Planning.overdue
		const unscheduled = Planning.unscheduled
		return html`
			${!overdue.length ? html.nothing : html`
				<section class="overdue">
					${this.headerTemplate(t('Overdue'), overdue.length)}
					<div class="entries" @pointerdown=${this.handlePointerDown}>
						<ul>
							${repeat(overdue, occurrence => EntryStore.identityOf(occurrence), occurrence => html`
								<li>
									<mitra-entry-segment dated .segment=${EntrySegments.for(occurrence)[0]}></mitra-entry-segment>
								</li>
							`)}
						</ul>
					</div>
				</section>
			`}
			<section class="unscheduled">
				${this.headerTemplate(t('Unscheduled'), unscheduled.length)}
				${!unscheduled.length ? html`
					<div class="empty">
						<mitra-icon icon="list-todo"></mitra-icon>
						<span>${t('Tasks without a date land here. Drag one onto the calendar to schedule it')}</span>
					</div>
				` : html`
					<div class="entries" @pointerdown=${this.handlePointerDown}>
						<ul>
							${repeat(unscheduled, occurrence => EntrySegments.for(occurrence)[0]!.id, (occurrence, index) => html`
								<li ${this.reorder.item({ index, disabled: !Planning.reorderable(occurrence) })}>
									<mitra-entry-segment dated .segment=${EntrySegments.for(occurrence)[0]}></mitra-entry-segment>
								</li>
							`)}
						</ul>
					</div>
				`}
			</section>
		`
	}

	private headerTemplate(heading: string, count: number) {
		return html`
			<header @pointerdown=${(e: Event) => e.stopPropagation()}>
				<h2>${heading}</h2>
				${!count ? html.nothing : html`<span class="count">${count.format()}</span>`}
			</header>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-planning': Planning
	}
}
