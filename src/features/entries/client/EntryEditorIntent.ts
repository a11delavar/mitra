import { type Entry } from '../Entry.js'
import { EntryStore } from './EntryStore.js'

/**
 * Tracks pending intent to open an entry editor across view navigation and refetches.
 */
export class EntryEditorIntent {
	private static pending?: Entry | string

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

	/** Clears pending request if no matching entry is present in the rendered set. */
	static settle(entries: ReadonlyArray<Entry>) {
		if (typeof this.pending === 'string' && !entries.some(entry => this.shouldOpen(entry))) {
			this.pending = undefined
		}
	}

	static reset() {
		this.pending = undefined
	}
}
