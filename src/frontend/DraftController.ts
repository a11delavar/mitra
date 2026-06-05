import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'
import type { Entry } from 'shared'

/**
 * Holds the one locally-created entry in flight — the draft you make by dragging (or, in the month view,
 * clicking a day) and then title or discard before making another. There's only ever a single draft (a
 * multi-day drag is one entry sliced into several segments).
 *
 * Draft-ness itself is *not* tracked here — it's intrinsic to the entry: a draft has no id until the
 * backend assigns one on create (see `Entry.persisted`). This store only does what can't live on the
 * entry: keep the not-yet-fetched draft around so views can render it ({@link mergeInto}), pop its editor
 * open once on drop, and drop the optimistic copy once a fetch echoes the saved entry back. It's static so
 * any component can read it without props bubbling through the page; components attach an instance to
 * subscribe.
 */
export class DraftController extends Controller {
	private static readonly hosts = new Set<ReactiveControllerHost>()
	private static draft?: Entry
	private static autoOpen = false

	private static requestUpdate() {
		this.hosts.forEach(host => host.requestUpdate())
	}

	/** Merge the draft a server fetch doesn't (yet) include, so a view renders it. */
	static mergeInto(entries: ReadonlyArray<Entry>): ReadonlyArray<Entry> {
		const draft = this.draft
		return !draft || entries.some(entry => entry.id === draft.id) ? entries : [...entries, draft]
	}

	/** Set/replace the in-progress drag draft (the gesture rebuilds the entry each move). */
	static upsertDraft(entry: Entry) {
		this.draft = entry
		this.requestUpdate()
	}

	/** Flag that the dropped draft's editor should pop open (consumed once it does). */
	static openDraft() {
		this.autoOpen = true
		this.requestUpdate()
	}

	static shouldAutoOpen(entry: Entry) {
		return this.autoOpen && this.draft === entry
	}

	static consumeAutoOpen() {
		this.autoOpen = false
	}

	/** Re-render after the draft has been given its server id (an in-place mutation Lit can't observe);
	 * the entry is now `persisted`, so it renders solid and stays merged until `reconcile` drops it. */
	static confirmCreated(entry: Entry, id: string) {
		entry.id = id
		this.requestUpdate()
	}

	static discard() {
		if (this.draft || this.autoOpen) {
			this.draft = undefined
			this.autoOpen = false
			this.requestUpdate()
		}
	}

	/** Drop the optimistic copy once the server returns it, so it renders from the authoritative entry.
	 * (A never-saved draft has no id, so it's only ever dropped here after it's actually been created.) */
	static reconcile(serverEntries: ReadonlyArray<Entry>) {
		const draft = this.draft
		if (draft?.id && serverEntries.some(entry => entry.id === draft.id)) {
			this.draft = undefined
			this.requestUpdate()
		}
	}

	// Instance reads (delegating to the shared store) — a subscribing component uses these so its
	// controller is a live dependency, not just a registration side-effect.
	merge(entries: ReadonlyArray<Entry>) {
		return DraftController.mergeInto(entries)
	}

	shouldAutoOpen(entry: Entry) {
		return DraftController.shouldAutoOpen(entry)
	}

	consumeAutoOpen() {
		DraftController.consumeAutoOpen()
	}

	discard() {
		DraftController.discard()
	}

	override hostConnected() {
		DraftController.hosts.add(this.host)
		this.host.requestUpdate()
	}

	override hostDisconnected() {
		DraftController.hosts.delete(this.host)
	}
}
