import { type Entry } from '../Entry.js'
import { EntryStore } from './EntryStore.js'

/**
 * Tracks pending intent to open an entry editor across view navigation and refetches.
 */
export class EntryEditorIntent {
	private static pending?: Entry | string
	private static editing?: Entry

	/** Request opening the editor for a draft entry. */
	static openDraft(draft: Entry) {
		this.pending = draft
		EntryStore.notify()
	}

	/** Request opening the editor for an entry by id after render/refetch. */
	static requestOpen(id: string) {
		this.pending = id
		EntryStore.notify()
	}

	/** Whether the given entry matches the pending open intent. */
	static shouldOpen(entry: Entry) {
		return typeof this.pending === 'string'
			? entry.id === this.pending || entry.recurrenceMasterId === this.pending
			: this.pending !== undefined && this.pending === entry
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
		}
	}

	static reset() {
		this.pending = undefined
		this.editing = undefined
	}
}
