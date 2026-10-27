import { Component, component, html, css, property, event, type PropertyValues } from '@a11d/lit'
import { type DateTime } from '@3mo/date-time'
import { pressable } from '#design'
import { type Entry } from '#features/entries'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'
import { EntryStore, reportSaveError } from '#features/entries/client/EntryStore.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import '#features/entries/client/TaskStatus.js'
import { hierarchy } from './Hierarchy.js'

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

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed)
		this.toggleAttribute('data-struck', this.entry.closed)
	}

	/** Navigates to the entry in the calendar, or straight to its editor when it has no date. */
	async open() {
		this.closest('mitra-entry-details')?.close()
		if (this.entry.start) {
			this.navigate.dispatch(this.entry.start)
		}
		// Asked only once its calendar shows, or a fetch without it would settle the request away.
		await Calendars.show(this.entry.sourceId)
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
		await (tracked ? EntryStore.commit(tracked) : EntryStore.persistence.update(target)).catch(reportSaveError)
		// A target the store does not hold is written past it, so no one listening hears it close: the follow-ups are offered here.
		if (!tracked && saved.closed) {
			hierarchy.offerFollowUps(saved).catch(() => void 0)
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
		return html`
			${this.entry.type.isTask ? html`
				<mitra-task-status style=${this.entry.effectiveColor ? `color: ${this.entry.effectiveColor};` : ''} .entry=${this.entry} @change=${() => this.handleStatusChange()}></mitra-task-status>
			` : html`
				<mitra-icon class="glyph" icon="calendar" style=${this.entry.effectiveColor ? `color: ${this.entry.effectiveColor};` : ''}></mitra-icon>
			`}
			${!this.entry.id
				? html`<span class="heading">${this.entry.heading}</span>`
				: html`<button type="button" class="heading" @click=${() => void this.open()}>${this.entry.heading}</button>`}
		`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'mitra-entry-link': EntryLink
	}
}
