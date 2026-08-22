import { Component, component, html, css, repeat } from '@a11d/lit'
import { Entry, EntryType, TaskStatus, type Source } from 'shared'
import { getPrimarySource, getVisibleSources } from './Api.js'
import { EntryStore } from './EntryStore.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { EntrySegments } from './EntrySegments.js'
import { EntryDragController } from './EntryDragController.js'
import type { EntrySegmentComponent } from './EventSegment.js'

/**
 * The calendar's complement: the entries no window of days can contain, because they have no start.
 * Deliberately NOT a second feed — it filters `EntryStore.entries` off the same windowed fetch (which
 * carries undated rows in every window, see backend/entries.ts), so nothing here knows about the
 * network.
 *
 * **It is a SECTION, not a panel**: no open state, no width, no breakpoint, no chrome. It fills
 * whatever box the shell hands it, because where planning surfaces live is a question we expect to
 * keep re-answering — the drag controller finds it by tag wherever it ends up.
 *
 * Its rows are the same `mitra-entry-segment` chips the grid draws, which is what makes the drag
 * between the two surfaces read as one object moving. The gesture is `EntryDragController`'s move
 * both ways (see `beginExternal`); this only hands over the pointer.
 */
@component('mitra-unscheduled')
export class Unscheduled extends Component {
	readonly store = new EntryStore(this)

	/** Finished last, alphabetical within each half: a backlog needs a stable order and no provider
	 * hands one over. A move's ghost lands here too whenever it hovers the section — having no span,
	 * it simply IS one of these rows. */
	private get entries(): ReadonlyArray<Entry> {
		return [...this.store.entries]
			.filter(entry => !entry.scheduled)
			.sort((a, b) => Number(Unscheduled.finished(a)) - Number(Unscheduled.finished(b))
				|| (a.heading || '').localeCompare(b.heading || ''))
	}

	/** Done and cancelled alike: both are tasks nobody has to schedule any more. */
	private static finished(entry: Entry) {
		return entry.status === TaskStatus.Done || entry.status === TaskStatus.Cancelled
	}

	/** The calendar new entries go to when it can hold tasks, else the first visible one that can. */
	private static get target(): Source | undefined {
		const primary = getPrimarySource()
		return primary?.supportsEntryType(EntryType.Task) ? primary : getVisibleSources().find(source => source.supportsEntryType(EntryType.Task))
	}

	/** What the shell gates its Add Task button on. */
	static get canAdd() {
		return !!Unscheduled.target
	}

	/**
	 * An ordinary create draft (no id, see Entry.persisted), so the store's untitled-draft guard is
	 * what keeps it local until it has a title.
	 *
	 * STATIC because the button does not live here: the shell places it, while what a new task IS
	 * stays with the section that lists them.
	 */
	static add() {
		const source = Unscheduled.target
		if (!source) {
			return
		}
		const draft = new Entry({ sourceId: source.id, type: EntryType.Task, heading: '' })
		EntryStore.upsertDraft(draft)
		EntryEditorIntent.openDraft(draft)
	}

	/**
	 * This element — not the row — is the capture element on purpose (see `beginExternal`), which is
	 * also why the mark and the open editor are exempt: a captured pointer retargets the trailing
	 * click, and those controls exist to receive it.
	 */
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
			mitra-unscheduled {
				display: flex;
				flex-direction: column;
				min-block-size: 0;
				gap: 0.5rem;

				/* The voice the account headings speak (see .integration > header), so the two lists read
				   as siblings in one column. */
				> header {
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

				> .entries {
					list-style: none;
					margin: 0;
					padding: 0;
					display: flex;
					flex-direction: column;
					gap: 0.25rem;
					overflow-y: auto;
					/* Deliberately NO touch-action: the browser's axis lock is what lets a downward drag
					   scroll this list while a sideways one swipes to the other tab. */
					flex: 1;
					min-block-size: 0;

					> li {
						flex-shrink: 0;
						display: flex;

						> mitra-entry-segment {
							inline-size: 100%;
							cursor: grab;
							padding-block: 0.25rem;
							/* The ONE thing this list says about the chip: here its height is FREE. A chip
							   is its own query container, and size containment sizes the box without
							   consulting its contents — right in a grid cell, wrong in a list. Every
							   height tier then reads "unknown", which is why the chip's tiers put the
							   ROOMY answer first (see EventSegment). */
							container-type: inline-size;
						}
					}
				}

				> .empty {
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
		const entries = this.entries
		return html`
			<header @pointerdown=${(e: Event) => e.stopPropagation()}>
				<h2>${t('Unscheduled')}</h2>
				${!entries.length ? html.nothing : html`<span class="count">${entries.length}</span>`}
			</header>
			${!entries.length ? html`
				<div class="empty">
					<mitra-icon icon="list-todo"></mitra-icon>
					<span>${t('Tasks without a date land here — drag one onto the calendar to schedule it')}</span>
				</div>
			` : html`
				<ul class="entries" @pointerdown=${this.handlePointerDown}>
					${repeat(entries, entry => EntrySegments.for(entry)[0]!.id, entry => html`
						<li>
							<mitra-entry-segment .segment=${EntrySegments.for(entry)[0]}></mitra-entry-segment>
						</li>
					`)}
				</ul>
			`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-unscheduled': Unscheduled
	}
}
