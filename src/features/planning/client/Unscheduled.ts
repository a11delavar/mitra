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
 * Section displaying unscheduled tasks filtered from EntryStore.
 */
@component('mitra-unscheduled')
export class Unscheduled extends Component {
	readonly store = new EntryStore(this)

	/** Visible unscheduled tasks matching current lens filters. */
	static get shown(): ReadonlyArray<Entry> {
		return [...HideDoneTasksSetting.filter(EntryStore.entries)]
			.filter(entry => !entry.scheduled)
			.sort((a, b) => Number(Unscheduled.finished(a)) - Number(Unscheduled.finished(b))
				|| (a.heading || '').localeCompare(b.heading || ''))
	}

	private get entries(): ReadonlyArray<Entry> {
		return Unscheduled.shown
	}

	private static finished(entry: Entry) {
		return entry.status === TaskStatus.Done || entry.status === TaskStatus.Cancelled
	}

	private static get target(): Source | undefined {
		return getPrimarySource(EntryType.Task)
	}

	static get canAdd() {
		return !!Unscheduled.target
	}

	static add() {
		const source = Unscheduled.target
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
			mitra-unscheduled {
				display: flex;
				flex-direction: column;
				min-block-size: 0;
				gap: 0.5rem;

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
					flex: 1;
					min-block-size: 0;

					> li {
						flex-shrink: 0;
						display: flex;

						> mitra-entry-segment {
							inline-size: 100%;
							cursor: grab;
							padding-block: 0.25rem;
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
