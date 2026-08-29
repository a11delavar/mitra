import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'
import { Recurrence, type RecurrenceScope } from '../../recurrence/Recurrence.js'
import { type EntryPlan, type SkippedEntry } from '../../relations/EntryPlan.js'
import { type Entry } from '../Entry.js'
import { ApiError, createEvent, deleteEvent, deleteOccurrence, editOccurrence, updateEvent, updateRelations } from '../../../infrastructure/http/Api.js'

export const reportSaveError = (error: unknown) =>
	console.error('Persisting the entry failed — the edit is kept locally and retried on the next change:', error)

/**
 * Central client store and persistence coordinator for entries.
 */
export class EntryStore extends Controller {
	private static readonly hosts = new Set<ReactiveControllerHost>()

	private static readonly workingById = new Map<string, Entry>()
	private static readonly canonicalById = new Map<string, Entry>()
	private static draft?: Entry
	private static preview?: Entry
	private static readonly duplicates = new Set<Entry>()
	private static readonly inflight = new Map<Entry, Promise<void>>()

	private static merged?: ReadonlyArray<Entry>
	private static dragging?: Entry

	static persistence = { create: createEvent, update: updateEvent, delete: deleteEvent, editOccurrence, deleteOccurrence }

	private static get shownPreview(): Entry | undefined {
		return this.preview && this.dragging && this.preview.editEquals(this.dragging) ? undefined : this.preview
	}

	static get entries(): ReadonlyArray<Entry> {
		return this.merged ??= [
			...this.workingById.values(),
			...this.duplicates,
			...(this.draft ? [this.draft] : []),
			...(this.shownPreview ? [this.shownPreview] : []),
		]
	}

	static notify() {
		this.merged = undefined
		this.hosts.forEach(host => host.requestUpdate())
	}

	static isDirty(entry: Entry) {
		if (!entry.persisted) {
			return true
		}
		const canonical = this.canonicalById.get(entry.id!)
		return !canonical || !entry.editEquals(canonical)
	}

	private static tracks(entry: Entry) {
		return this.draft === entry || (entry.id !== undefined && this.workingById.get(entry.id) === entry)
	}

	static resolveScope: (entry: Entry, intent: 'edit' | 'delete') => Promise<RecurrenceScope | undefined> =
		() => Promise.resolve('all')

	/** Post-save hook fired after local task completion/cancellation. */
	static onTaskClosed: (entry: Entry) => void = () => void 0

	/**
	 * Persists local changes to the server, chaining in-flight updates and resolving recurrence scope.
	 */
	static commit(entry: Entry, scope?: RecurrenceScope): Promise<void> {
		const pending = this.inflight.get(entry)
		if (pending) {
			return pending
		}
		if (!entry.persisted && !entry.heading?.trim()) {
			return Promise.resolve()
		}
		const wasClosed = entry.persisted && (this.canonicalById.get(entry.id!)?.closed ?? false)
		const run = (async () => {
			try {
				while (this.tracks(entry) && this.isDirty(entry)) {
					const sent = entry.clone()
					if (entry.recurrenceMasterId && !this.ruleChanged(entry)) {
						const preset = scope
						scope = undefined
						if (!await this.commitOccurrence(entry, sent, preset)) {
							break
						}
						continue
					}
					const saved = entry.persisted ? await EntryStore.persistence.update(entry) : await EntryStore.persistence.create(entry)
					if (!entry.persisted) {
						entry.id = saved.id
						this.draft = this.draft === entry ? undefined : this.draft
						this.workingById.set(entry.id!, entry)
					} else if (!entry.recurrenceMasterId && saved.id !== undefined && saved.id !== entry.id) {
						if (this.workingById.get(entry.id!) === entry) {
							this.workingById.delete(entry.id!)
							this.canonicalById.delete(entry.id!)
						}
						entry.id = saved.id
						this.workingById.set(entry.id!, entry)
					}
					if (!this.tracks(entry)) {
						break
					}
					if (entry.recurrenceMasterId) {
						this.canonicalById.set(entry.id!, sent)
					} else {
						this.canonicalById.set(entry.id!, saved.clone())
						if (entry.editEquals(sent)) {
							entry.assign(saved)
						}
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
			// Successful transition into closed state; runs outside finally so failed saves never prompt.
			if (!wasClosed && entry.type.isTask && entry.closed && this.tracks(entry)) {
				this.onTaskClosed(entry)
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

	/**
	 * Optimistically applies and persists a relation mutation to the entry's series master.
	 * Restores prior relations on failure and rethrows.
	 */
	static async commitRelations(owner: Entry, mutate: () => void): Promise<void> {
		const before = owner.relations ?? null
		mutate()
		this.notify()
		const id = owner.recurrenceMasterId ?? owner.id
		if (!id) {
			return
		}
		try {
			this.adoptRelations(await updateRelations(id, owner.relations ?? null))
		} catch (error) {
			owner.relations = before
			this.notify()
			throw error
		}
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

	/**
	 * Whether the entry's only change against canonical is task progress/status.
	 * Scoped edits to occurrence completion commit directly as 'this' without prompting for recurrence scope.
	 */
	private static completionOnlyChanged(entry: Entry) {
		const canonical = this.canonicalById.get(entry.id!)
		if (!canonical) {
			return false
		}
		const probe = entry.clone()
		probe.status = canonical.status
		probe.percentComplete = canonical.percentComplete
		return probe.editEquals(canonical) && !entry.editEquals(canonical)
	}

	private static async commitOccurrence(entry: Entry, sent: Entry, preset?: RecurrenceScope): Promise<boolean> {
		const scope = preset ?? (this.completionOnlyChanged(entry) ? 'this' : await EntryStore.resolveScope(entry, 'edit'))
		if (!this.tracks(entry)) {
			return false
		}
		if (!scope) {
			this.revert(entry)
			return false
		}
		const saved = await EntryStore.persistence.editOccurrence(entry, scope)
		if (!this.tracks(entry)) {
			return false
		}
		if (scope === 'this') {
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
			this.canonicalById.set(entry.id!, sent)
		}
		this.notify()
		return true
	}

	/** Creates a standalone copy of an entry and persists it. */
	static async duplicate(entry: Entry, span: Entry = entry): Promise<Entry> {
		const duplicate = entry.duplicate()
		duplicate.adoptSpan(span)
		this.duplicates.add(duplicate)
		this.notify()
		try {
			const saved = await EntryStore.persistence.create(duplicate)
			duplicate.assign(saved)
			this.workingById.set(duplicate.id!, duplicate)
			this.canonicalById.set(duplicate.id!, saved.clone())
			return duplicate
		} finally {
			this.duplicates.delete(duplicate)
			this.notify()
		}
	}

	/** Deletes an entry or scoped series occurrences optimistically with rollback on error. */
	static async delete(entry: Entry, scope?: RecurrenceScope) {
		const pending = this.inflight.get(entry)
		if (entry.recurrenceMasterId) {
			scope ??= await EntryStore.resolveScope(entry, 'delete')
			if (!scope) {
				return
			}
			const restore = this.dropScoped(entry, scope)
			await pending?.catch(() => void 0)
			this.drop(entry)
			try {
				if (scope === 'all') {
					await EntryStore.persistence.delete(entry.recurrenceMasterId)
				} else {
					await EntryStore.persistence.deleteOccurrence(entry, scope)
				}
			} catch (error) {
				if (!(error instanceof ApiError && error.status === 404)) {
					restore()
				}
				throw error
			}
			return
		}
		const dropped: Array<{ entry: Entry, canonical?: Entry }> = []
		if (entry.recurrence && entry.id !== undefined) {
			for (const sibling of [...this.workingById.values()]) {
				if (sibling !== entry && sibling.recurrenceMasterId === entry.id) {
					dropped.push(this.captureAndDrop(sibling))
				}
			}
		}
		dropped.push(this.captureAndDrop(entry))
		await pending?.catch(() => void 0)
		this.drop(entry)
		if (entry.persisted) {
			try {
				await EntryStore.persistence.delete(entry.id!)
			} catch (error) {
				if (!(error instanceof ApiError && error.status === 404)) {
					this.reinstate(dropped)
				}
				throw error
			}
		}
	}

	private static dropScoped(entry: Entry, scope: RecurrenceScope): () => void {
		const masterId = entry.recurrenceMasterId!
		const cutoff = entry.recurrenceId?.valueOf() ?? -Infinity
		const dropped: Array<{ entry: Entry, canonical?: Entry }> = []
		for (const sibling of [...this.workingById.values()]) {
			if (sibling === entry || sibling.recurrenceMasterId !== masterId) {
				continue
			}
			if (scope === 'all' || (scope === 'following' && (sibling.recurrenceId?.valueOf() ?? -Infinity) >= cutoff)) {
				dropped.push(this.captureAndDrop(sibling))
			}
		}
		dropped.push(this.captureAndDrop(entry))
		return () => this.reinstate(dropped)
	}

	private static captureAndDrop(entry: Entry): { entry: Entry, canonical?: Entry } {
		const canonical = entry.id !== undefined ? this.canonicalById.get(entry.id) : undefined
		this.drop(entry)
		return { entry, canonical }
	}

	private static reinstate(dropped: ReadonlyArray<{ entry: Entry, canonical?: Entry }>) {
		for (const { entry, canonical } of dropped) {
			if (entry.id !== undefined && !this.workingById.has(entry.id)) {
				this.workingById.set(entry.id, entry)
				this.canonicalById.set(entry.id, canonical ?? entry.clone())
			}
		}
		this.notify()
	}

	private static live(entry: Entry) {
		return (entry.id !== undefined ? this.workingById.get(entry.id) : undefined) ?? entry
	}

	static async applyPlan(plan: EntryPlan): Promise<{ failed: Array<Entry>, skipped: ReadonlyArray<SkippedEntry> }> {
		const failed = new Array<Entry>()
		for (const entry of plan.deletions) {
			const target = this.live(entry)
			const write = target === entry && !this.tracks(target) ? EntryStore.persistence.delete(target.id!) : this.delete(target, 'all')
			await write.catch(() => void failed.push(entry))
		}
		for (const { entry, mutate } of plan.writes) {
			const target = this.live(entry)
			mutate(target)
			this.notify()
			if (this.tracks(target)) {
				await this.commit(target, 'all').catch(() => { this.revert(target); failed.push(entry) })
			} else {
				await EntryStore.persistence.update(target).catch(() => void failed.push(entry))
			}
		}
		if (plan.count) {
			this.notify()
		}
		return { failed, skipped: plan.skipped }
	}

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

	static upsertDraft(entry: Entry) {
		this.draft = entry
		this.notify()
	}

	static discardDraft() {
		if (this.draft?.heading?.trim()) {
			return
		}
		if (this.draft) {
			this.draft = undefined
			this.notify()
		}
	}

	static setDragging(entry: Entry | undefined) {
		if (this.dragging !== entry) {
			this.dragging = entry
			this.notify()
		}
	}

	static setPreview(entry: Entry | undefined) {
		this.preview = entry
		this.notify()
	}

	static isDragging(entry: Entry) {
		return this.dragging === entry && this.preview === undefined
	}

	static get dragSource(): Entry | undefined {
		return this.shownPreview === undefined ? undefined : this.dragging
	}

	static isDragSource(entry: Entry) {
		return this.dragSource === entry
	}

	static isPreview(entry: Entry) {
		return this.shownPreview !== undefined && this.shownPreview === entry
	}

	static reset() {
		this.workingById.clear()
		this.canonicalById.clear()
		this.inflight.clear()
		this.duplicates.clear()
		this.draft = undefined
		this.preview = undefined
		this.merged = undefined
		this.dragging = undefined
	}

	get entries() {
		return EntryStore.entries
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

	override hostConnected() {
		EntryStore.hosts.add(this.host)
		this.host.requestUpdate()
	}

	override hostDisconnected() {
		EntryStore.hosts.delete(this.host)
	}
}
