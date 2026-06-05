import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'
import type { Entry } from 'shared'

/**
 * Holds the one local entry in flight — whether being **created** (a drag/click draft with no id yet) or
 * **edited** (a clone of an existing entry whose start/end a move/resize gesture is changing). There's only
 * ever one. This store does what can't live on the entry itself: render the pending entry ({@link mergeInto}
 * substitutes it over the server copy by id, or appends a not-yet-saved draft), pop a new draft's editor
 * open once on drop, and drop the optimistic copy once a fetch echoes the *matching* server state back.
 *
 * Draft-ness is intrinsic to the entry (no id ⇒ unsaved, see `Entry.persisted`), not tracked here. The
 * store is static so any component can read it without props bubbling through the page; components attach
 * an instance to subscribe.
 */
export class DraftController extends Controller {
	private static readonly hosts = new Set<ReactiveControllerHost>()
	private static draft?: Entry
	private static autoOpen = false
	private static dragging = false

	private static requestUpdate() {
		this.hosts.forEach(host => host.requestUpdate())
	}

	/** Render the pending entry: substitute it over the server copy with the same id (an edit), or append
	 * it when the server doesn't have it yet (a not-yet-saved create draft, which has no id). */
	static mergeInto(entries: ReadonlyArray<Entry>): ReadonlyArray<Entry> {
		const draft = this.draft
		if (!draft) {
			return entries
		}
		let replaced = false
		const merged = entries.map(entry => {
			if (draft.id !== undefined && entry.id === draft.id) {
				replaced = true
				return draft
			}
			return entry
		})
		return replaced ? merged : [...merged, draft]
	}

	/** Set/replace the in-flight entry (a gesture rebuilds the clone each move). */
	static upsertDraft(entry: Entry) {
		this.draft = entry
		this.requestUpdate()
	}

	/** Flag that the dropped draft's editor should pop open (consumed once it does). Create only. */
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

	/** Whether `entry` is the one being actively dragged (move/resize), so a view can float it above its
	 * cluster instead of re-flowing with it each frame. */
	static setDragging(value: boolean) {
		if (this.dragging !== value) {
			this.dragging = value
			this.requestUpdate()
		}
	}
	static isDragging(entry: Entry) {
		return this.dragging && this.draft === entry
	}

	/** Re-render after a create draft has been given its server id (an in-place mutation Lit can't observe);
	 * the entry is now `persisted`, so it renders solid and stays merged until `reconcile` drops it. */
	static confirmCreated(entry: Entry, id: string) {
		entry.id = id
		this.requestUpdate()
	}

	/** Drop the pending entry. With `entry`, only if it's still the current draft — so a late-failing
	 * update reverts its own edit without clobbering a newer gesture's in-progress draft. */
	static discard(entry?: Entry) {
		if (entry && this.draft !== entry) {
			return
		}
		if (this.draft || this.autoOpen || this.dragging) {
			this.draft = undefined
			this.autoOpen = false
			this.dragging = false
			this.requestUpdate()
		}
	}

	/** Drop the optimistic copy once the server reflects it, so it renders from the authoritative entry.
	 * Matches on *content*, not just id: an edit shares its id with the server copy from the start, so id
	 * alone would drop the overlay on the first refetch — before the update echoes — and snap the entry
	 * back to its pre-edit position. A create's draft simply has no id until it's saved. */
	static reconcile(serverEntries: ReadonlyArray<Entry>) {
		const draft = this.draft
		if (!draft?.id) {
			return
		}
		const server = serverEntries.find(entry => entry.id === draft.id)
		if (server
			&& server.start?.valueOf() === draft.start?.valueOf()
			&& server.end?.valueOf() === draft.end?.valueOf()
			&& !!server.allDay === !!draft.allDay) {
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

	isDragging(entry: Entry) {
		return DraftController.isDragging(entry)
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
