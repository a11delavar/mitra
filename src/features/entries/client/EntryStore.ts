import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { type EntryPlan, type SkippedEntry } from '../../relations/EntryPlan.js'
import { type Entry } from '../Entry.js'
import { ApiError, createEvent, deleteEvent, deleteOccurrence, editOccurrence, rankEntries, updateEvent, updateRelations } from '../../../infrastructure/http/Api.js'
import { EntryRank } from '../EntryRank.js'
import { EntryPatch } from '../EntryPatch.js'
import { EntryRelations } from '../../relations/EntryRelations.js'
import { EntryOccurrenceChangeScope } from '../../recurrence/EntryOccurrenceChange.js'
import { type EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
import { TimeZone } from '../../time/TimeZone.js'

export const reportSaveError = (error: unknown) =>
	console.error('Persisting the entry failed. The edit is kept locally and retried on the next change:', error)

/** Central client store and persistence coordinator for entries. */
export class EntryStore extends Controller {
	private static readonly hosts = new Map<ReactiveControllerHost, EntryStore>()

	private static readonly workingById = new Map<string, Entry>()
	private static readonly canonicalById = new Map<string, Entry>()
	private static draft?: Entry
	private static preview?: Entry
	private static readonly duplicates = new Set<Entry>()
	private static readonly inflight = new Map<Entry, Promise<void>>()

	private static merged?: ReadonlyArray<Entry>
	private static composed?: ReadonlyArray<EntryOccurrence>
	private static dragging?: Entry
	/** The window the entries were fetched for, whose dates the recurring ones yield; none for every entry once. */
	private static window?: DateTimeRange

	static persistence = { create: createEvent, update: updateEvent, delete: deleteEvent, editOccurrence, deleteOccurrence, reorder: rankEntries }

	/** A drag only ever moves the span, so a ghost occupying the source's is a second copy of it, even when both are dateless. */
	private static get shownPreview(): Entry | undefined {
		return this.preview && this.dragging && this.preview.spanEquals(this.dragging) ? undefined : this.preview
	}

	static get entries(): ReadonlyArray<Entry> {
		return this.merged ??= [
			...this.workingById.values(),
			...this.duplicates,
			...(this.draft ? [this.draft] : []),
			...(this.shownPreview ? [this.shownPreview] : []),
		]
	}

	/**
	 * What the views show: each one-off entry once, a recurring entry's dates in the window (an unscheduled task's current
	 * one, each entry's first without a window), and the overrides standing in for some of them.
	 */
	static get occurrences(): ReadonlyArray<EntryOccurrence> {
		return this.composed ??= this.compose()
	}

	private static compose() {
		const entries = this.entries
		const overridesOf = Map.groupBy(entries.filter(entry => entry.recurringEntryId), entry => entry.recurringEntryId!)
		const recurring = new Set(entries.filter(entry => entry.occurrences.recurring).map(entry => entry.id))
		const window = this.window
		return entries.flatMap(entry => {
			if (entry.recurringEntryId && recurring.has(entry.recurringEntryId)) {
				return []
			}
			if (!entry.occurrences.recurring) {
				return [entry.occurrences.single]
			}
			const overrides = overridesOf.get(entry.id!) ?? []
			if (window && entry.start) {
				return entry.occurrences.within(window, overrides)
			}
			const occurrence = !window ? entry.occurrences.anchored : entry.occurrences.current(TimeZone.deviceId)
			const override = overrides.find(override => override.recurrenceId?.getTime() === occurrence?.recurrenceId?.getTime())
			return !occurrence ? [] : [override ? entry.occurrences.overriddenBy(override) : occurrence]
		})
	}

	/**
	 * What keeps an occurrence the same chip across renders: a date its rule yields by its key, which an override taking the
	 * date over keeps, anything else by its entry, whose dates a drag changes. The drag's preview is a chip of its own.
	 */
	static identityOf(occurrence: EntryOccurrence): unknown {
		return occurrence.recurring && !this.isPreview(occurrence.entry) ? occurrence.key : occurrence.entry
	}

	/** The occurrence `entry` shows: its own, or for an override the date of its recurring entry it takes over. */
	static occurrenceOf(entry: Entry) {
		const recurring = entry.recurringEntryId ? this.workingById.get(entry.recurringEntryId) : undefined
		return recurring ? recurring.occurrences.overriddenBy(entry) : entry.occurrences.single
	}

	/**
	 * The entry an edit of `occurrence` changes: its own, else an override of the date, which the store keeps under the
	 * occurrence's key so the views show the edit in its place.
	 */
	static editable(occurrence: EntryOccurrence): Entry {
		if (!occurrence.recurring || occurrence.entry.recurringEntryId) {
			return occurrence.entry
		}
		const key = occurrence.key!
		let override = this.workingById.get(key)
		if (!override) {
			override = occurrence.override()
			this.workingById.set(key, override)
			this.canonicalById.set(key, override.clone())
			this.notify()
		}
		return override
	}

	/** Something about the entries changed, which every host may show. */
	static notify() {
		this.merged = undefined
		this.composed = undefined
		this.hosts.forEach((_, host) => host.requestUpdate())
	}

	/**
	 * Only where `entries` lie changed, as on every drag step: the views that lay them out update, and of the hosts
	 * showing a single entry or a derived value only those it changes.
	 */
	static notifyMoved(...entries: ReadonlyArray<Entry | undefined>) {
		this.merged = undefined
		this.composed = undefined
		for (const [host, store] of this.hosts) {
			if (store.movedBy(entries)) {
				host.requestUpdate()
			}
		}
	}

	static isDirty(entry: Entry) {
		if (!entry.persisted) {
			return true
		}
		const canonical = this.canonicalById.get(entry.id!)
		return !canonical || !entry.equals(canonical)
	}

	private static tracks(entry: Entry) {
		return this.draft === entry || (entry.id !== undefined && this.workingById.get(entry.id) === entry)
	}

	static resolveScope: (entry: Entry, intent: 'edit' | 'delete') => Promise<EntryOccurrenceChangeScope | undefined> =
		() => Promise.resolve(EntryOccurrenceChangeScope.All)

	/** Post-save hook fired after local task completion/cancellation. */
	static onTaskClosed: (entry: Entry) => void = () => void 0

	/** Persists local changes, chaining in-flight updates and resolving recurrence scope. */
	static commit(entry: Entry, scope?: EntryOccurrenceChangeScope): Promise<void> {
		const pending = this.inflight.get(entry)
		if (pending) {
			return pending
		}
		if (!entry.persisted && !entry.heading?.trim() && !entry.type.isAvailability) {
			return Promise.resolve()
		}
		// With nothing to send, the run below never awaits, so its `finally` would clear the slot before
		// `inflight.set` filled it, and the settled promise would swallow every later commit.
		if (!this.tracks(entry) || !this.isDirty(entry)) {
			return Promise.resolve()
		}
		const wasClosed = entry.persisted && (this.canonicalById.get(entry.id!)?.closed ?? false)
		const run = (async () => {
			try {
				while (this.tracks(entry) && this.isDirty(entry)) {
					const sent = entry.clone()
					if (entry.recurringEntryId && !this.ruleChanged(entry)) {
						const preset = scope
						scope = undefined
						if (!await this.commitOccurrence(entry, sent, preset)) {
							break
						}
						continue
					}
					// Through an occurrence only a rule edit gets here, and the rule goes to every occurrence.
					const saved = !entry.persisted ? await EntryStore.persistence.create(entry)
						: await EntryStore.persistence.update(entry, entry.recurringEntryId ? [...EntryPatch.shared, 'recurrence'] : undefined)
					if (!entry.persisted) {
						entry.id = saved.id
						this.draft = this.draft === entry ? undefined : this.draft
						this.workingById.set(entry.id!, entry)
					} else if (!entry.recurringEntryId && saved.id !== undefined && saved.id !== entry.id) {
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
					if (entry.recurringEntryId) {
						this.canonicalById.set(entry.id!, sent)
					} else {
						this.canonicalById.set(entry.id!, saved.clone())
						if (entry.equals(sent)) {
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

	/** Whether the entry's rule differs from its canonical. A rule edit is series-wide by definition,
	 * so it bypasses the scope dialog and routes straight to the master. */
	private static ruleChanged(entry: Entry) {
		return !Recurrence.equal(entry.recurrence, this.canonicalById.get(entry.id!)?.recurrence)
	}

	/** Optimistically applies and persists a relation mutation on the series master, restoring the prior relations on failure. */
	static async commitRelations(owner: Entry, mutate: () => void): Promise<void> {
		const before = owner.relations
		mutate()
		this.notify()
		const id = owner.recurringEntryId ?? owner.id
		if (!id) {
			return
		}
		try {
			this.adoptRelations(await updateRelations(id, owner.relations ?? EntryRelations.none))
		} catch (error) {
			owner.relations = before
			this.notify()
			throw error
		}
	}

	/** Adopts a relations-only result onto the tracked copies. An incoming-line removal edits another entry than the
	 * editor's, and a dirty copy of it would otherwise resurrect the removed link with its next full PUT. */
	static adoptRelations(saved: Entry) {
		if (saved.id === undefined) {
			return
		}
		const working = this.workingById.get(saved.id)
		const canonical = this.canonicalById.get(saved.id)
		if (working) {
			working.relations = saved.relations
		}
		if (canonical) {
			canonical.relations = saved.relations
		}
		if (working || canonical) {
			this.notify()
		}
	}

	/** Whether only task progress or status changed, which commits as 'this' without asking for a scope. */
	private static completionOnlyChanged(entry: Entry) {
		const canonical = this.canonicalById.get(entry.id!)
		if (!canonical) {
			return false
		}
		const probe = entry.clone()
		probe.status = canonical.status
		probe.percentComplete = canonical.percentComplete
		return probe.equals(canonical) && !entry.equals(canonical)
	}

	/** Whether an unscheduled occurrence just got its start. Only that one is being planned, so it goes without asking. */
	private static schedulesOccurrence(entry: Entry) {
		return !!entry.start && !this.canonicalById.get(entry.id!)?.start
	}

	private static async commitOccurrence(entry: Entry, sent: Entry, preset?: EntryOccurrenceChangeScope): Promise<boolean> {
		const scope = preset ?? (this.completionOnlyChanged(entry) || this.schedulesOccurrence(entry) ? EntryOccurrenceChangeScope.This : await EntryStore.resolveScope(entry, 'edit'))
		if (!this.tracks(entry)) {
			return false
		}
		if (!scope) {
			this.revert(entry)
			return false
		}
		const saved = await EntryStore.persistence.editOccurrence(this.occurrenceOf(entry), scope)
		if (!this.tracks(entry)) {
			return false
		}
		if (scope === EntryOccurrenceChangeScope.This) {
			if (this.workingById.get(entry.id!) === entry) {
				this.workingById.delete(entry.id!)
				this.canonicalById.delete(entry.id!)
			}
			entry.id = saved.id
			entry.recurringEntryId = undefined
			entry.recurrenceId = undefined
			entry.recurrence = undefined
			entry.uid = saved.uid
			this.workingById.set(entry.id!, entry)
			this.canonicalById.set(entry.id!, saved.clone())
			if (entry.equals(sent)) {
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
	static async delete(entry: Entry, scope?: EntryOccurrenceChangeScope) {
		const pending = this.inflight.get(entry)
		if (entry.recurringEntryId) {
			scope ??= await EntryStore.resolveScope(entry, 'delete')
			if (!scope) {
				return
			}
			const restore = this.dropScoped(entry, scope)
			await pending?.catch(() => void 0)
			this.drop(entry)
			try {
				if (scope === EntryOccurrenceChangeScope.All) {
					await EntryStore.persistence.delete(entry.recurringEntryId)
				} else {
					await EntryStore.persistence.deleteOccurrence(this.occurrenceOf(entry), scope)
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
				if (sibling !== entry && sibling.recurringEntryId === entry.id) {
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

	private static dropScoped(entry: Entry, scope: EntryOccurrenceChangeScope): () => void {
		const masterId = entry.recurringEntryId!
		const cutoff = entry.recurrenceId?.valueOf() ?? -Infinity
		const dropped: Array<{ entry: Entry, canonical?: Entry }> = []
		for (const sibling of [...this.workingById.values()]) {
			if (sibling === entry || sibling.recurringEntryId !== masterId) {
				continue
			}
			if (scope === EntryOccurrenceChangeScope.All || (scope === EntryOccurrenceChangeScope.Following && (sibling.recurrenceId?.valueOf() ?? -Infinity) >= cutoff)) {
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
			const write = target === entry && !this.tracks(target) ? EntryStore.persistence.delete(target.id!) : this.delete(target, EntryOccurrenceChangeScope.All)
			await write.catch(() => void failed.push(entry))
		}
		for (const { entry, mutate } of plan.writes) {
			const target = this.live(entry)
			mutate(target)
			this.notify()
			if (this.tracks(target)) {
				await this.commit(target, EntryOccurrenceChangeScope.All).catch(() => { this.revert(target); failed.push(entry) })
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

	/**
	 * Canonical copies always refresh; a working copy takes the server's values only while clean and idle. Working copies
	 * the fetch lacks drop when clean and stay while dirty or saving, where an external delete resolves at that save's 404.
	 */
	static applyServerEntries(entries: ReadonlyArray<Entry>, window?: DateTimeRange) {
		this.window = window
		const incomingIds = new Set<string>()
		// The store keeps overrides as rows of their own, which edits change like any other.
		for (const incoming of entries.flatMap(entry => [entry, ...entry.overrides ?? []])) {
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
			if (incomingIds.has(id) || this.inflight.has(working) || this.isDirty(working)) {
				continue
			}
			// A clean override an editor may hold stays while its date does, with what its entry holds now.
			const recurring = working.recurringEntryId ? this.workingById.get(working.recurringEntryId) : undefined
			if (recurring?.occurrences.recurring && recurring.occurrences.yields(working.recurrenceId!)) {
				working.assign(Object.assign(recurring.occurrences.at(working.recurrenceId!).override(), { id }))
				this.canonicalById.set(id, working.clone())
			} else {
				this.workingById.delete(id)
				this.canonicalById.delete(id)
			}
		}
		this.notify()
	}

	/** Places the entry between two neighbors of the listed order and stores what changed: only the entry,
	 * unless the neighbors can't decide a rank, in which case the whole list is ranked afresh first. */
	static async reorder(listed: ReadonlyArray<Entry>, entry: Entry, previous?: Entry, next?: Entry): Promise<void> {
		const before = new Map([...listed, entry].map(each => [each, each.rank]))
		try {
			// A neighbor without a rank (null) cannot decide one; a missing neighbor (undefined) leaves its side open.
			const placed = EntryRank.tryBetween(previous && (previous.rank ?? null), next && (next.rank ?? null))
			if (!placed) {
				EntryRank.sequence(listed.length).forEach((rank, index) => listed[index]!.rank = rank)
			}
			entry.rank = placed ?? EntryRank.between(previous?.rank, next?.rank)
			this.notify()
			const changed = placed ? [entry] : [...new Set([...listed, entry])]
			// A repeating task holds its place through its series.
			await EntryStore.persistence.reorder(Object.fromEntries(changed.map(each => [each.masterId!, each.rank!.key])))
		} catch (error) {
			before.forEach((rank, each) => each.rank = rank)
			this.notify()
			console.error('Reordering failed. The previous order is restored:', error)
		}
	}

	static upsertDraft(entry: Entry) {
		const previous = this.draft
		this.draft = entry
		this.notifyMoved(previous, entry)
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
			const previous = this.dragging
			this.dragging = entry
			this.notifyMoved(previous, entry, this.preview)
		}
	}

	/** Whether this exact preview is the one on screen. */
	static previewing(entry: Entry) {
		return this.preview === entry
	}

	static setPreview(entry: Entry | undefined) {
		// Re-notifies even for the same instance, which drags mutate in place; nothing to nothing can't.
		if (this.preview === undefined && entry === undefined) {
			return
		}
		const previous = this.preview
		this.preview = entry
		this.notifyMoved(previous, entry, this.dragging)
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
		this.composed = undefined
		this.window = undefined
		this.dragging = undefined
	}

	get entries() {
		return EntryStore.entries
	}

	get occurrences() {
		return EntryStore.occurrences
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

	constructor(host: ReactiveControllerHost, private readonly options: {
		/** The one entry a host shows, as a chip does, so a drag of another leaves it be. */
		readonly entry?: () => Entry | undefined
		/** What a host shows of the entries, as the sidebar its badge count, so a drag that leaves it be leaves the host be. */
		readonly shows?: () => unknown
	} = {}) {
		super(host as never)
	}

	/** What `shows` gave when the host last rendered. */
	private shown?: unknown

	private movedBy(entries: ReadonlyArray<Entry | undefined>) {
		const { entry, shows } = this.options
		if (entry) {
			const own = entry()
			return !!own && entries.includes(own)
		}
		return !shows || shows() !== this.shown
	}

	override hostUpdate() {
		this.shown = this.options.shows?.()
	}

	override hostConnected() {
		EntryStore.hosts.set(this.host, this)
		this.host.requestUpdate()
	}

	override hostDisconnected() {
		EntryStore.hosts.delete(this.host)
	}
}
