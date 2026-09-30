import { Component, component, html, css, repeat } from '@a11d/lit'
import { type Source } from '../../sources/Source.js'
import { EntryType } from '../../entries/EntryType.js'
import { Entry, TaskStatus } from '../../entries/Entry.js'
import { getPrimarySource } from '../../../infrastructure/http/Api.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { EntryEditorIntent } from '../../entries/client/EntryEditorIntent.js'
import { EntrySegments } from '../../entries/client/EntrySegments.js'
import { EntryDragController } from '../../entries/client/EntryDragController.js'
import { HideDoneTasksSetting } from '../../entries/client/HideDoneTasksSetting.js'
import type { EntrySegmentComponent } from '../../entries/client/EventSegment.js'

/**
 * The two lists of tasks awaiting a decision: the ones whose day has passed, and the ones that never
 * got a day. Neither is bounded by the window the calendar is showing.
 */
@component('mitra-planning')
export class Planning extends Component {
	readonly store = new EntryStore(this)

	/**
	 * Open tasks whose day has gone by, most overdue first. A drag's ghost belongs to the grid it is
	 * being dropped on: nothing is dropped into this list, so a preview that happens to be overdue
	 * too would only read as a second copy of the entry already here.
	 */
	static get overdue(): ReadonlyArray<Entry> {
		return EntryStore.entries
			.filter(entry => entry.overdue && !EntryStore.previewing(entry))
			.sort((a, b) => a.lastDay!.valueOf() - b.lastDay!.valueOf())
	}

	/** Visible unscheduled tasks matching current lens filters. */
	static get unscheduled(): ReadonlyArray<Entry> {
		return [...HideDoneTasksSetting.filter(EntryStore.entries)]
			.filter(entry => !entry.scheduled)
			.sort((a, b) => Number(Planning.finished(a)) - Number(Planning.finished(b))
				|| (a.heading || '').localeCompare(b.heading || ''))
	}

	/** What the tab badge counts: everything either list is asking the user to decide about. */
	static get pending() {
		return Planning.overdue.length + Planning.unscheduled.length
	}

	private static finished(entry: Entry) {
		return entry.status === TaskStatus.Done || entry.status === TaskStatus.Cancelled
	}

	private static get target(): Source | undefined {
		return getPrimarySource(EntryType.Task)
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
		const entry = segment?.segment?.entry
		if (segment && entry?.persisted) {
			EntryDragController.beginExternal(entry, segment, this, e)
		}
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
							${repeat(overdue, entry => entry.id, entry => html`
								<li>
									<mitra-entry-segment dated .segment=${EntrySegments.for(entry)[0]}></mitra-entry-segment>
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
							${repeat(unscheduled, entry => EntrySegments.for(entry)[0]!.id, entry => html`
								<li>
									<mitra-entry-segment .segment=${EntrySegments.for(entry)[0]}></mitra-entry-segment>
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
				${!count ? html.nothing : html`<span class="count">${count}</span>`}
			</header>
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-planning': Planning
	}
}
