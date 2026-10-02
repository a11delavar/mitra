import { type Entry } from '../Entry.js'
import { EntryStore } from './EntryStore.js'

/**
 * Which entry the editor is on: the one open right now, and the one it has been asked to open across
 * view navigation and refetches. Display lenses keep what it {@link holds} rendered, and the calendar
 * page mirrors its {@link target} into the URL.
 */
export class EntryEditorIntent {
	private static pending?: Entry | string

	/** Fires `request` on every open request. A view that guards its templates re-renders nothing for one,
	 * so segments listen here to update themselves. */
	static readonly requests = new EventTarget()
	private static editing?: Entry

	/** The open entry as an id, or the requested one until it renders. A draft has none and is
	 * deliberately absent: an unsaved entry is nothing to link back to. */
	static get target() {
		return this.editing?.id ?? (typeof this.pending === 'string' ? this.pending : undefined)
	}

	/** Request opening the editor for a draft entry. */
	static openDraft(draft: Entry) {
		this.pending = draft
		EntryStore.notify()
		this.requests.dispatchEvent(new Event('request'))
	}

	/** Request opening the editor for an entry by id after render/refetch. */
	static requestOpen(id: string) {
		this.pending = id
		EntryStore.notify()
		this.requests.dispatchEvent(new Event('request'))
	}

	/** Whether the given entry matches the pending open intent. */
	static shouldOpen(entry: Entry) {
		if (typeof this.pending !== 'string') {
			return this.pending !== undefined && this.pending === entry
		}
		// Only a series' occurrences render, not its master. A master saved locally is replaced by its
		// occurrences on the next fetch, so opening it would close the editor again right away.
		if (entry.recurrence && !entry.isRecurring) {
			return false
		}
		return entry.id === this.pending || entry.recurrenceMasterId === this.pending
	}

	static consume() {
		this.pending = undefined
	}

	/** Records entry with active editor to keep it visible while display lenses are active. */
	static setEditing(entry: Entry, open: boolean) {
		const editing = open ? entry : this.isEditing(entry) ? undefined : this.editing
		if (this.editing !== editing) {
			this.editing = editing
			EntryStore.notify()
		}
	}

	/** Whether the entry (or its persisted equivalent) is currently being edited. */
	static isEditing(entry: Entry) {
		return this.editing !== undefined
			&& (this.editing === entry || (this.editing.id !== undefined && this.editing.id === entry.id))
	}

	/** Whether the entry is active or pending editor open and must remain rendered. */
	static holds(entry: Entry) {
		return this.shouldOpen(entry) || this.isEditing(entry)
	}

	/** Clears pending request if no matching entry is present in the rendered set. */
	static settle(entries: ReadonlyArray<Entry>) {
		if (typeof this.pending === 'string' && !entries.some(entry => this.shouldOpen(entry))) {
			this.pending = undefined
			EntryStore.notify()
		}
	}

	static reset() {
		this.pending = undefined
		this.editing = undefined
	}
}
