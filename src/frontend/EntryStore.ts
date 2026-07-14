import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'
import { Recurrence, Relation, type Entry, type RecurrenceScope } from 'shared'
import { ApiError, createEvent, deleteEvent, deleteOccurrence, editOccurrence, updateEvent, updateRelations } from './Api.js'

/**
 * The frontend's single source of truth for entries, layered so the UI never waits for the network:
 *
 * 1. **Update** — edits mutate an entry in place (binder writes, `Entry.moveStart` & co, drag frames)
 *    and call {@link notify}; every subscribed view re-renders the same frame.
 * 2. **Store** — an identity map: one stable working instance per id (plus the one id-less create
 *    draft), so open editors, segment memos, and view-transition names survive server refreshes. Each
 *    working entry has a *canonical* snapshot — its last server-confirmed value copy. **Dirty is
 *    derived**: the working copy differs from canonical (`Entry.editEquals`); a draft has no canonical,
 *    so it's dirty by construction — no flags, same spirit as `Entry.persisted`.
 * 3. **Persist** — {@link commit} runs one save chain per entry: as long as the entry is dirty, save it
 *    (POST for a draft — which graduates in place — else PUT) and refresh canonical from the response.
 *    Re-checking dirtiness after each round is all the coalescing logic there is: an edit made while a
 *    request is in flight simply leaves the entry dirty, so the loop saves again. Responses update the
 *    store directly — rendering never depends on the sync echo.
 * 4. **Reconcile** — {@link applyServerEntries} adopts each fetched entry: canonical always refreshes;
 *    values are assigned onto the working instance only when it's clean, so a pending local edit wins
 *    until its own save confirms it (rebase-lite, whole-entry last-write-wins).
 *
 * The store is static so any component can read it without props bubbling through the page; components
 * attach an instance to subscribe.
 */
export class EntryStore extends Controller {
	private static readonly hosts = new Set<ReactiveControllerHost>()

	private static readonly workingById = new Map<string, Entry>()
	private static readonly canonicalById = new Map<string, Entry>()
	/** The one local, unpersisted entry (a drag/click create draft). Draft-ness is intrinsic to the
	 * entry (no id ⇒ unsaved, see `Entry.persisted`), not tracked here. */
	private static draft?: Entry
	/** A move gesture's ghost: an id-less clone of the dragged entry at the pointer's target span.
	 * Having no id, it renders dashed through the same rule as a draft — dashed *means* "the server
	 * doesn't have this yet", which is exactly what a mid-gesture position is. */
	private static preview?: Entry
	private static readonly inflight = new Map<Entry, Promise<void>>()

	private static merged?: ReadonlyArray<Entry>
	private static autoOpen = false
	private static dragging?: Entry

	/** The transport — a boundary, not state; swappable in tests. */
	static persistence = { create: createEvent, update: updateEvent, delete: deleteEvent, editOccurrence, deleteOccurrence, updateRelations }

	/** The ghost is only *shown* while it previews an actual change. Back over the entry's own slot it
	 * edit-equals its source (it's a clone differing only in span), releasing would change nothing —
	 * so nothing should render as pending: no ghost, no dimmed source, just the entry as it is. */
	private static get shownPreview(): Entry | undefined {
		return this.preview && this.dragging && this.preview.editEquals(this.dragging) ? undefined : this.preview
	}

	/** The merged view every component renders: the working instances plus the create draft and the
	 * move-gesture preview. Rebuilt (new array identity) per {@link notify}, so array-typed properties
	 * see the change; ordering is irrelevant — `EntrySegments` sorts everything it lays out. */
	static get entries(): ReadonlyArray<Entry> {
		return this.merged ??= [
			...this.workingById.values(),
			...(this.draft ? [this.draft] : []),
			...(this.shownPreview ? [this.shownPreview] : []),
		]
	}

	/** Re-render everything that renders entries. The one call every in-place mutation makes — nothing
	 * else has to happen for the UI to be current. */
	static notify() {
		this.merged = undefined
		this.hosts.forEach(host => host.requestUpdate())
	}

	/** Whether the entry has local changes its canonical (last server-confirmed) copy doesn't. */
	static isDirty(entry: Entry) {
		if (!entry.persisted) {
			return true // a draft has no canonical — dirty by construction
		}
		const canonical = this.canonicalById.get(entry.id!)
		return !canonical || !entry.editEquals(canonical)
	}

	/** Whether this exact instance is the one the store renders — the create draft or the working copy
	 * under its id. A dropped (deleted) or superseded instance isn't, which stops its save chain. */
	private static tracks(entry: Entry) {
		return this.draft === entry || (entry.id !== undefined && this.workingById.get(entry.id) === entry)
	}

	// --- Persist ---------------------------------------------------------------------------------------

	/**
	 * How far a series edit/delete should reach — injected by the app as the scope dialog; resolving
	 * `undefined` means the user cancelled (the edit reverts / the delete doesn't happen). The default
	 * applies series-wide, so headless contexts (tests) behave without wiring.
	 */
	static resolveScope: (entry: Entry, intent: 'edit' | 'delete') => Promise<RecurrenceScope | undefined> =
		() => Promise.resolve('all')

	/**
	 * Save the entry's local changes — the *only* path from an edit to the server. Returns the entry's
	 * running save chain if it already has one; the chain re-checks dirtiness after every response, so
	 * "queue another save" is never remembered anywhere — it's re-derived. A failed round leaves the
	 * entry dirty (the edit is kept, the next change retries) and rejects, except a PUT 404, which means
	 * the entry was deleted externally — then the local copy is dropped rather than resurrected.
	 *
	 * A dirty series occurrence first resolves a {@link resolveScope scope}: 'this' detaches it into a
	 * standalone entry (the instance adopts the new identity in place), 'following' splits the series,
	 * 'all' shifts/edits the whole series — for the latter two the response is a master, not this
	 * synthetic instance, so what was sent becomes its canonical and the sync echo re-shapes the series
	 * around it. Rule edits are exempt: a rule is series-wide by definition, so they go straight to the
	 * master without a dialog. A status-only change is exempt the other way around: completing a task
	 * belongs to the single occurrence by nature, so it commits with scope 'this' without asking.
	 */
	static commit(entry: Entry): Promise<void> {
		const pending = this.inflight.get(entry)
		if (pending) {
			return pending
		}
		if (!entry.persisted && !entry.heading?.trim()) {
			return Promise.resolve() // an untitled draft isn't committed yet
		}
		const run = (async () => {
			try {
				while (this.tracks(entry) && this.isDirty(entry)) {
					const sent = entry.clone() // what this round is saving, to detect mid-flight edits
					// A relations-ONLY edit on an occurrence PUTs just the relations to the master —
					// never the occurrence's other content: a synced override's own heading (an
					// externally renamed occurrence) must not stomp the series' on an unrelated
					// relationship gesture. (Mixed relations+content edits still take the generic
					// master route below — the same series-wide semantics scope 'all' applies.)
					if (entry.recurrenceMasterId && this.onlyRelationsChanged(entry)) {
						await EntryStore.persistence.updateRelations(entry.recurrenceMasterId, entry.relations ?? null)
						if (!this.tracks(entry)) {
							break
						}
						this.canonicalById.set(entry.id!, sent)
						this.notify()
						continue
					}
					if (entry.recurrenceMasterId && !this.ruleChanged(entry) && !this.relationsChanged(entry)) {
						if (!await this.commitOccurrence(entry, sent)) {
							break
						}
						continue
					}
					const saved = entry.persisted ? await EntryStore.persistence.update(entry) : await EntryStore.persistence.create(entry)
					if (!entry.persisted) {
						// The draft graduates in place — same instance, now persisted. Adopted into the identity
						// map even if a newer gesture displaced it from the draft slot meanwhile: it exists on
						// the server now (an explicit mid-flight delete re-drops it — see `delete`).
						entry.id = saved.id
						this.draft = this.draft === entry ? undefined : this.draft
						this.workingById.set(entry.id!, entry)
					} else if (!entry.recurrenceMasterId && saved.id !== undefined && saved.id !== entry.id) {
						// A migration to another source re-created the entry over there — same instance, new
						// identity. Rekey unconditionally (id is identity, not content — a mid-flight edit
						// must PUT against the new id on its next round).
						if (this.workingById.get(entry.id!) === entry) {
							this.workingById.delete(entry.id!)
							this.canonicalById.delete(entry.id!)
						}
						entry.id = saved.id
						this.workingById.set(entry.id!, entry)
					}
					if (!this.tracks(entry)) {
						break // deleted while the request was in flight — stop; the queued delete finishes the job
					}
					if (entry.recurrenceMasterId) {
						// A rule edit routed to the MASTER, and `saved` IS the master — nothing may be adopted
						// onto this synthetic instance. What was sent is what the series now carries here, so
						// confirm it as this occurrence's canonical; the expansion echoes it back.
						this.canonicalById.set(entry.id!, sent)
					} else {
						this.canonicalById.set(entry.id!, saved.clone())
						if (entry.editEquals(sent)) {
							entry.assign(saved) // untouched during the flight → adopt the server-normalized values
						} // else: still dirty against the new canonical — the loop saves again
					}
					this.notify()
				}
			} catch (error) {
				if (entry.persisted && error instanceof ApiError && error.status === 404) {
					this.drop(entry)
				}
				throw error
			} finally {
				this.inflight.delete(entry)
				this.notify()
			}
		})()
		this.inflight.set(entry, run)
		return run
	}

	/** Whether the entry's rule differs from its canonical — a rule edit is series-wide by definition,
	 * so it bypasses the scope dialog and routes straight to the master. */
	private static ruleChanged(entry: Entry) {
		return !Recurrence.equal(entry.recurrence, this.canonicalById.get(entry.id!)?.recurrence)
	}

	/** Whether the entry's relations differ from its canonical — like a rule edit, a relation edit is
	 * series-wide by definition (relationships live on the master, see shared/Relation.ts), so it
	 * bypasses the scope dialog and routes straight to the master. */
	private static relationsChanged(entry: Entry) {
		return !Relation.listEquals(entry.relations ?? null, this.canonicalById.get(entry.id!)?.relations ?? null)
	}

	/** Whether the entry's ONLY change against its canonical is its relations (the statusOnlyChanged
	 * probe pattern) — the case the commit loop turns into a relations-only master PUT. */
	private static onlyRelationsChanged(entry: Entry) {
		const canonical = this.canonicalById.get(entry.id!)
		if (!canonical || !this.relationsChanged(entry)) {
			return false
		}
		const probe = entry.clone()
		probe.relations = canonical.relations
		return probe.editEquals(canonical)
	}

	/** The last server-confirmed relations of a tracked entry — what a terminal (400) rejection
	 * reverts to (a captured pre-edit array could itself be stale when several edits share one save
	 * chain); `undefined` when the entry isn't tracked. */
	static canonicalRelations(entry: Entry): Array<Relation> | null | undefined {
		const canonical = entry.id === undefined ? undefined : this.canonicalById.get(entry.id)
		return canonical ? canonical.relations ?? null : undefined
	}

	/** Adopt a relations-only server result onto the tracked copies of that entry — the
	 * incoming-line removal edits ANOTHER entry than the open editor's, and if that other entry's
	 * working copy happens to be dirty, leaving its old relations in place would resurrect the
	 * removed link with its next full PUT. */
	static adoptRelations(saved: Entry) {
		if (saved.id === undefined) {
			return
		}
		const working = this.workingById.get(saved.id)
		const canonical = this.canonicalById.get(saved.id)
		if (working) {
			working.relations = saved.relations ?? null
		}
		if (canonical) {
			canonical.relations = saved.relations ?? null
		}
		if (working || canonical) {
			this.notify()
		}
	}

	/** Whether the entry's ONLY change against its canonical is the task status. A status belongs to the
	 * single occurrence by nature — completing this Tuesday's task says nothing about the rest of the
	 * series — so asking for a scope makes no sense and the edit commits as 'this'. Of the editable
	 * fields it's the sole one like that: the rule is the opposite extreme (series-wide, see
	 * {@link ruleChanged}); everything else — heading, schedule, colour, reminders… — is genuinely
	 * ambiguous and keeps the dialog. A status change *mixed* with other edits keeps it too: the whole
	 * edit takes one scope, and the rest of it is ambiguous. */
	private static statusOnlyChanged(entry: Entry) {
		const canonical = this.canonicalById.get(entry.id!)
		if (!canonical || entry.status === canonical.status) {
			return false
		}
		const probe = entry.clone()
		probe.status = canonical.status
		return probe.editEquals(canonical)
	}

	/** One scoped save round for a dirty occurrence. Returns false when the commit chain should stop
	 * (cancelled, or the entry was deleted mid-flight). */
	private static async commitOccurrence(entry: Entry, sent: Entry): Promise<boolean> {
		const scope = this.statusOnlyChanged(entry) ? 'this' : await EntryStore.resolveScope(entry, 'edit')
		if (!this.tracks(entry)) {
			return false
		}
		if (!scope) {
			this.revert(entry) // cancelled — snap back to the series' state
			return false
		}
		const saved = await EntryStore.persistence.editOccurrence(entry, scope)
		if (!this.tracks(entry)) {
			return false
		}
		if (scope === 'this') {
			// Detached into a standalone entry: same instance, new (real) identity — and no longer part
			// of the series, whatever happened mid-flight (the link fields are identity, not content).
			if (this.workingById.get(entry.id!) === entry) {
				this.workingById.delete(entry.id!)
				this.canonicalById.delete(entry.id!)
			}
			entry.id = saved.id
			entry.recurrenceMasterId = undefined
			entry.recurrenceId = undefined
			entry.recurrence = undefined
			entry.seriesStart = undefined
			entry.uid = saved.uid
			this.workingById.set(entry.id!, entry)
			this.canonicalById.set(entry.id!, saved.clone())
			if (entry.editEquals(sent)) {
				entry.assign(saved)
			}
		} else {
			// 'all' / 'following': the response is a master (the series' or the continuation's), not this
			// synthetic instance. What was sent is what the series now shows here — confirm it as this
			// occurrence's canonical; the sync echo re-shapes the rest of the series.
			this.canonicalById.set(entry.id!, sent)
		}
		this.notify()
		return true
	}

	/** Delete: gone from the view immediately; the server call waits for any in-flight save (a pending
	 * create has to land first — the delete needs the id it produces). Deleting a series occurrence
	 * first resolves a {@link resolveScope scope} — this one, this and following, or the whole series —
	 * and the matching local instances drop at once rather than on the sync echo. */
	static async delete(entry: Entry) {
		const pending = this.inflight.get(entry)
		if (entry.recurrenceMasterId) {
			const scope = await EntryStore.resolveScope(entry, 'delete')
			if (!scope) {
				return // cancelled — nothing happens
			}
			this.dropScoped(entry, scope)
			await pending?.catch(() => void 0)
			this.drop(entry)
			if (scope === 'all') {
				await EntryStore.persistence.delete(entry.recurrenceMasterId)
			} else {
				await EntryStore.persistence.deleteOccurrence(entry, scope)
			}
			return
		}
		// A master row (rare — the series itself, before the echo replaces it with occurrences) deletes
		// the whole series, taking its local occurrences along.
		if (entry.recurrence && entry.id !== undefined) {
			for (const sibling of [...this.workingById.values()]) {
				if (sibling !== entry && sibling.recurrenceMasterId === entry.id) {
					this.drop(sibling)
				}
			}
		}
		this.drop(entry)
		await pending?.catch(() => void 0) // its failure is its own — the delete proceeds on what exists
		this.drop(entry) // a create that landed mid-delete graduated the entry back in — drop it again
		if (entry.persisted) {
			await EntryStore.persistence.delete(entry.id!)
		}
	}

	/** The local half of a scoped series delete: this instance, plus — per scope — its siblings from
	 * the same series (all of them, or the ones at/after this occurrence's original start). */
	private static dropScoped(entry: Entry, scope: RecurrenceScope) {
		const masterId = entry.recurrenceMasterId!
		const cutoff = entry.recurrenceId?.valueOf() ?? -Infinity
		for (const sibling of [...this.workingById.values()]) {
			if (sibling === entry || sibling.recurrenceMasterId !== masterId) {
				continue
			}
			if (scope === 'all' || (scope === 'following' && (sibling.recurrenceId?.valueOf() ?? -Infinity) >= cutoff)) {
				this.drop(sibling)
			}
		}
		this.drop(entry)
	}

	/** Undo local changes: a draft is dropped (it only ever existed locally); a persisted entry snaps
	 * back to its canonical values — in place, so everything holding the instance follows. */
	static revert(entry: Entry) {
		if (!entry.persisted) {
			this.drop(entry)
			return
		}
		const canonical = this.canonicalById.get(entry.id!)
		if (canonical) {
			entry.assign(canonical.clone())
			this.notify()
		}
	}

	private static drop(entry: Entry) {
		if (this.draft === entry) {
			this.draft = undefined
			this.autoOpen = false
		}
		if (entry.id !== undefined && this.workingById.get(entry.id) === entry) {
			this.workingById.delete(entry.id)
			this.canonicalById.delete(entry.id)
		}
		if (this.dragging === entry) {
			this.dragging = undefined
		}
		this.notify()
	}

	// --- Reconcile -------------------------------------------------------------------------------------

	/**
	 * Adopt a fetched window of server entries. Canonical always refreshes; the working instance only
	 * takes the incoming values while it's clean and idle — a dirty or mid-save entry keeps its local
	 * values (they're about to overwrite the server's anyway). Working entries the fetch no longer
	 * contains are dropped when clean (deleted externally, or outside the fetched window) and kept while
	 * dirty/saving — an external delete then resolves at that save's 404. The create draft, having no
	 * id, passes through untouched.
	 */
	static applyServerEntries(entries: ReadonlyArray<Entry>) {
		const incomingIds = new Set<string>()
		for (const incoming of entries) {
			if (incoming.id === undefined) {
				continue
			}
			incomingIds.add(incoming.id)
			const working = this.workingById.get(incoming.id)
			if (!working) {
				this.workingById.set(incoming.id, incoming)
				this.canonicalById.set(incoming.id, incoming.clone())
				continue
			}
			const clean = !this.inflight.has(working) && !this.isDirty(working)
			this.canonicalById.set(incoming.id, incoming.clone())
			if (clean) {
				working.assign(incoming)
			}
		}
		for (const [id, working] of [...this.workingById]) {
			if (!incomingIds.has(id) && !this.inflight.has(working) && !this.isDirty(working)) {
				this.workingById.delete(id)
				this.canonicalById.delete(id)
			}
		}
		this.notify()
	}

	// --- Create-gesture view flow (carried over from the former DraftController) -------------------------

	/** Set/replace the create draft (a gesture rebuilds it each frame). */
	static upsertDraft(entry: Entry) {
		this.draft = entry
		this.notify()
	}

	/** Drop the create draft (a closed untitled editor, a cancelled create gesture) — but only an
	 * untitled placeholder. A titled draft is a real entry whose create is (about to be) in flight;
	 * dismissing UI around it — a click on the empty grid, a cancelled unrelated gesture — must not
	 * destroy it. It leaves the view by graduating, or through an explicit {@link delete}. */
	static discardDraft() {
		if (this.draft?.heading?.trim()) {
			return
		}
		if (this.draft || this.autoOpen) {
			this.draft = undefined
			this.autoOpen = false
			this.notify()
		}
	}

	/** Flag that the dropped draft's editor should pop open (consumed once it does). Create only. */
	static openDraft() {
		this.autoOpen = true
		this.notify()
	}

	static shouldAutoOpen(entry: Entry) {
		return this.autoOpen && this.draft === entry
	}

	static consumeAutoOpen() {
		this.autoOpen = false
	}

	/** The id of a persisted entry whose editor should pop open once its segment renders — set by the
	 * command palette after it navigates to the entry. Kept until consumed, so it survives the async
	 * refetch the navigation triggers. */
	private static openEntryId?: string

	/** Request that the entry with this id open its editor when it next renders (see {@link openDraft}
	 * for the draft counterpart). A recurring master matches its rendered occurrences too, so picking a
	 * series from the palette opens the occurrence the navigation lands on. */
	static requestOpen(id: string) {
		this.openEntryId = id
		this.notify()
	}

	static shouldOpen(entry: Entry) {
		return this.openEntryId !== undefined && (entry.id === this.openEntryId || entry.recurrenceMasterId === this.openEntryId)
	}

	static consumeOpen() {
		this.openEntryId = undefined
	}

	/** The persisted entry an active move/resize gesture targets. A *move* additionally shows a
	 * {@link setPreview preview} ghost; a *resize* manipulates the entry itself live — the presence of
	 * the preview is what tells the two apart, no mode flag needed. */
	static setDragging(entry: Entry | undefined) {
		if (this.dragging !== entry) {
			this.dragging = entry
			this.notify()
		}
	}

	/** Set/clear the move gesture's ghost (the same instance is mutated and re-set each frame). */
	static setPreview(entry: Entry | undefined) {
		this.preview = entry
		this.notify()
	}

	/** Whether `entry` is being *resized* live — float it above its cluster instead of re-flowing with
	 * it each frame. Only a resize leaves the preview slot empty (a move always fills it, shown or
	 * not), so no gesture-kind flag is needed. */
	static isDragging(entry: Entry) {
		return this.dragging === entry && this.preview === undefined
	}

	/** Whether `entry` is the origin of an in-progress move that would actually move it — render it
	 * dimmed in place, as the reference the user is dragging away from. */
	static isDragSource(entry: Entry) {
		return this.dragging === entry && this.shownPreview !== undefined
	}

	/** Whether `entry` is the move gesture's shown ghost — float it above the cluster it passes over,
	 * and leave it out of the packing (`EntrySegments`): it and its source are the same entry. */
	static isPreview(entry: Entry) {
		return this.shownPreview !== undefined && this.shownPreview === entry
	}

	/** Forget everything — test isolation only; the app never resets the store. */
	static reset() {
		this.workingById.clear()
		this.canonicalById.clear()
		this.inflight.clear()
		this.draft = undefined
		this.preview = undefined
		this.merged = undefined
		this.autoOpen = false
		this.openEntryId = undefined
		this.dragging = undefined
	}

	// Instance reads (delegating to the shared store) — a subscribing component uses these so its
	// controller is a live dependency, not just a registration side-effect.
	get entries() {
		return EntryStore.entries
	}

	shouldAutoOpen(entry: Entry) {
		return EntryStore.shouldAutoOpen(entry)
	}

	shouldOpen(entry: Entry) {
		return EntryStore.shouldOpen(entry)
	}

	consumeOpen() {
		EntryStore.consumeOpen()
	}

	isDragging(entry: Entry) {
		return EntryStore.isDragging(entry)
	}

	isDragSource(entry: Entry) {
		return EntryStore.isDragSource(entry)
	}

	isPreview(entry: Entry) {
		return EntryStore.isPreview(entry)
	}

	consumeAutoOpen() {
		EntryStore.consumeAutoOpen()
	}

	override hostConnected() {
		EntryStore.hosts.add(this.host)
		this.host.requestUpdate()
	}

	override hostDisconnected() {
		EntryStore.hosts.delete(this.host)
	}
}
