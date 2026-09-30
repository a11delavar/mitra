import { Component, component, html, css, property, event, type PropertyValues } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { TaskStatus, type Entry } from '../../entries/Entry.js'
import { EntryEditorIntent } from '../../entries/client/EntryEditorIntent.js'
import { EntryStore, reportSaveError } from '../../entries/client/EntryStore.js'
import { getSource, updateEvent } from '../../../infrastructure/http/Api.js'
import { offerFollowUps } from './Hierarchy.js'
import '../../entries/client/TaskStatus.js'
import { pressable } from '../../../design/pressable.css.js'

/**
 * Another entry, named where one entry points at it: a task's status, which can be changed right here,
 * or an event's glyph, in its calendar's colour, and its heading, which opens it.
 */
@component('mitra-entry-link')
export class EntryLink extends Component {
	@property({ type: Object }) entry!: Entry

	/** The palette's contract: the calendar navigates to the date, and the intent opens the editor once the entry renders there. */
	@event({ bubbles: true, composed: true }) readonly navigate!: EventDispatcher<DateTime>

	protected override createRenderRoot() { return this }

	private get struck() {
		const { entry } = this
		return entry.type.isTask && (entry.done || entry.status === TaskStatus.Done || entry.status === TaskStatus.Cancelled)
	}

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		this.toggleAttribute('data-struck', this.struck)
	}

	/** Navigates to the entry in the calendar, or straight to its editor when it has no date. */
	open() {
		this.closest('mitra-entry-details')?.close()
		if (this.entry.start) {
			this.navigate.dispatch(this.entry.start)
		}
		EntryEditorIntent.requestOpen(this.entry.id!)
	}

	/** Updates the store's own instance where it tracks one, or writes the entry directly. */
	private async handleStatusChange() {
		const target = this.entry
		EntryStore.notify()
		if (!target.persisted) {
			this.requestUpdate()
			return
		}
		const tracked = EntryStore.entries.find(entry => entry.id === target.id)
		if (tracked && tracked !== target) {
			tracked.status = target.status
			tracked.percentComplete = target.percentComplete
			EntryStore.notify()
		}
		const saved = tracked ?? target
		await (tracked ? EntryStore.commit(tracked) : updateEvent(target)).catch(reportSaveError)
		// Direct API writes bypass EntryStore.onTaskClosed, so the follow-up offers are made here.
		if (saved.closed) {
			offerFollowUps(saved).catch(() => void 0)
		}
		this.requestUpdate()
	}

	static override get styles() {
		return css`
			mitra-entry-link {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				min-width: 0;

				> mitra-task-status {
					font-size: 0.85rem;
					inline-size: 0.85rem;
					block-size: 0.85rem;
					flex-shrink: 0;
				}

				> mitra-icon.glyph {
					font-size: 0.8rem;
					inline-size: 0.85rem;
					block-size: 0.85rem;
					display: flex;
					align-items: center;
					justify-content: center;
					flex-shrink: 0;
					color: var(--color-text-muted);
				}

				> .heading {
					flex: 1;
					min-width: 0;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				&[data-struck] > .heading {
					text-decoration: line-through;
					color: var(--color-text-muted);
				}

				/* A heading that leads somewhere is a button without any of the standalone button chrome. */
				> button.heading {
					${pressable};
					text-align: start;

					&:hover,
					&:focus-visible {
						text-decoration: underline;
					}
				}

				&[data-struck] > button.heading {
					&:hover,
					&:focus-visible {
						text-decoration: line-through underline;
					}
				}
			}
		`
	}

	protected override get template() {
		const { entry } = this
		const color = entry.color || getSource(entry.sourceId)?.color
		return html`
			${entry.type.isTask ? html`
				<mitra-task-status style=${color ? `color: ${color};` : ''} .entry=${entry} @change=${() => this.handleStatusChange()}></mitra-task-status>
			` : html`
				<mitra-icon class="glyph" icon="calendar" style=${color ? `color: ${color};` : ''}></mitra-icon>
			`}
			${!entry.id
				? html`<span class="heading">${entry.heading}</span>`
				: html`<button type="button" class="heading" @click=${() => this.open()}>${entry.heading}</button>`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-link': EntryLink
	}
}
