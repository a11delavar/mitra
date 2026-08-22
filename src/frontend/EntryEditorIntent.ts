import { type Entry } from 'shared'
import { EntryStore } from './EntryStore.js'

/**
 * Which entry's editor should pop open — *view* intent, which is why it isn't in `EntryStore`
 * (that one is about entry data). It stays a shared static for the same reason the store is one:
 * `mitra-entry-segment` is nested several views deep, so the alternative is prop-drilling the target
 * through `mitra-days`/`mitra-month` → `mitra-day`. And it must be *held* rather than fired as an
 * event, because navigating to a picked entry refetches — the segment that should open doesn't exist
 * yet when the intent is raised.
 *
 * One pending target covers both cases: the create draft (matched by instance — a dropped draft
 * simply never renders again, so nothing has to clear the intent) and a persisted entry (matched by
 * id, which survives the refetch). Fan-out rides on `EntryStore.notify()` rather than a second
 * subscription mechanism: every view that renders entries is exactly the audience for this too.
 */
export class EntryEditorIntent {
	private static pending?: Entry | string

	/** Pop the freshly dropped draft's editor open (create gestures, the palette's Create Entry). */
	static openDraft(draft: Entry) {
		this.pending = draft
		EntryStore.notify()
	}

	/** Open this persisted entry's editor once its segment renders — the command palette after it
	 * navigates to a picked entry, and the editor's own Duplicate. */
	static requestOpen(id: string) {
		this.pending = id
		EntryStore.notify()
	}

	/** A recurring master matches its rendered occurrences too, so picking a series opens the
	 * occurrence the navigation lands on. */
	static shouldOpen(entry: Entry) {
		return typeof this.pending === 'string'
			? entry.id === this.pending || entry.recurrenceMasterId === this.pending
			: this.pending !== undefined && this.pending === entry
	}

	static consume() {
		this.pending = undefined
	}

	/** Bound a request the fetch didn't resolve — a hidden or deleted entry would otherwise sit
	 * pending until some later window happened to contain it and auto-opened it. */
	static settle(entries: ReadonlyArray<Entry>) {
		if (typeof this.pending === 'string' && !entries.some(entry => this.shouldOpen(entry))) {
			this.pending = undefined
		}
	}

	/** Forget the pending target — test isolation only. */
	static reset() {
		this.pending = undefined
	}
}
