import { type Entry, type RecurrenceScope, RelationType, TaskStatus } from 'shared'
import { getEntryHierarchy, updateEvent, deleteEvent, type EntryHierarchyView } from './Api.js'
import { EntryStore } from './EntryStore.js'
import { DialogEntryScope, type EntryScope } from './components/DialogEntryScope.js'
import { DialogCompleteParent } from './components/DialogCompleteParent.js'
import { DialogCloseSubtasks } from './components/DialogCloseSubtasks.js'

/**
 * Hierarchy actions: the last-child completion prompt and hierarchy-scoped gestures (delete/move).
 * Resolves parents and subtrees from the server since related entries may sit outside the current window.
 */

/** Relationships (and therefore hierarchy) are series-level: an occurrence stands in for its master. */
const targetIdOf = (entry: Entry) => entry.recurrenceMasterId ?? entry.id

/** Subtree size from the attached rollup. */
export function subtreeSize(entry: Entry): number {
	return entry.subtasks?.descendants ?? 0
}

/** Resolves gesture scope across recurrence and hierarchy axes. Bypass (Ctrl/⌘) defaults to narrowest. */
export function resolveScope(entry: Entry, intent: 'edit' | 'move' | 'delete', bypass = false, hasSubtaskAction = true): Promise<EntryScope | undefined> {
	const series = !!entry.recurrenceMasterId
	const subtasks = hasSubtaskAction && (intent === 'delete' || intent === 'move') ? subtreeSize(entry) : 0
	if (bypass || (!series && !subtasks)) {
		return Promise.resolve({ recurrence: series ? 'this' as const : undefined, subtasks: false })
	}
	return new DialogEntryScope({ entry, intent, series, subtasks }).confirm()
}

/** Fetches subtree entries from the server after a confirmed scoped gesture. */
async function subtree(entry: Entry): Promise<EntryHierarchyView['descendants']> {
	const id = targetIdOf(entry)
	return !id ? [] : (await getEntryHierarchy(id)).descendants
}

/** Returns the live store instance if tracked in the current window, else the fetched entry. */
const trackedOr = (fetched: Entry) => EntryStore.entries.find(entry => entry.id === fetched.id) ?? fetched

// --- Follow-up offers ---------------------------------------------------------------------------------
// Closing a task can resolve hierarchy upwards (parent now completed) or downwards (subtasks now moot).

/** Depth of an offer currently being applied to avoid re-triggering recursive prompts on child writes. */
let applying = 0

/** Entries with an offer currently in flight to prevent duplicate prompts from concurrent save hooks. */
const offering = new Set<string>()

/**
 * Prompts follow-up offers (downwards subtask closure, then upwards parent completion) for a closed task.
 */
export async function offerFollowUps(entry: Entry) {
	const id = targetIdOf(entry)
	if (!id || !entry.type.isTask || offering.has(id)) {
		return
	}
	offering.add(id)
	try {
		await runFollowUps(entry, id)
	} finally {
		offering.delete(id)
	}
}

async function runFollowUps(entry: Entry, id: string) {
	const view = await getEntryHierarchy(id).catch(() => undefined)
	if (!view) {
		return
	}
	// Offer closing subtasks first, then parent completion if the hierarchy is fully resolved.
	await offerToCloseSubtasks(entry, view.descendants)
	await offerToCompleteParents(view.parents)
}

/** Direct children from descendants, matching parent or child relation directions. */
function directChildrenOf(entry: Entry, descendants: ReadonlyArray<Entry>): Array<Entry> {
	const uid = entry.uid
	if (!uid) {
		return []
	}
	const claimed = new Set((entry.relations ?? [])
		.filter(relation => RelationType.of(relation.type) === RelationType.Child)
		.map(relation => relation.targetUid))
	return descendants.filter(child => (child.uid !== undefined && claimed.has(child.uid))
		|| (child.relations ?? []).some(relation => RelationType.of(relation.type) === RelationType.Parent && relation.targetUid === uid))
}

/** Offers to close remaining open direct subtasks when a parent task is closed. */
async function offerToCloseSubtasks(entry: Entry, descendants: ReadonlyArray<Entry>) {
	const outstanding = directChildrenOf(entry, descendants).filter(child => child.type.isTask && !child.closed)
	if (!outstanding.length) {
		return
	}
	const closure = await new DialogCloseSubtasks({ entry, outstanding: outstanding.length }).confirm().catch(() => undefined)
	if (!closure) {
		return // dismissed — a closed parent over open subtasks is a legal state, not an error
	}
	applying++
	try {
		for (const child of outstanding) {
			const target = trackedOr(child)
			target.status = closure
			// RFC 5545 §3.8.1.8: percent-complete is 100 on Done; Cancelled retains its existing progress.
			if (closure === TaskStatus.Done) {
				target.percentComplete = 100
			}
			EntryStore.notify()
			await (target === child ? updateEvent(target) : EntryStore.commit(target)).catch(() => void 0)
		}
	} finally {
		applying--
	}
}

/** Offers to complete parent tasks whose remaining subtasks are now all done or cancelled. */
async function offerToCompleteParents(parents: ReadonlyArray<Entry>) {
	for (const parent of parents) {
		// Only prompt for task parents with all tasks completed (cancelled tasks excluded from total).
		const rollup = parent.subtasks
		if (!parent.type.isTask || parent.closed || !rollup?.total || rollup.done < rollup.total) {
			continue
		}
		if (!await new DialogCompleteParent({ parent }).confirm().catch(() => undefined)) {
			continue
		}
		applying++
		try {
			const target = trackedOr(parent)
			target.status = TaskStatus.Done
			target.percentComplete = 100
			EntryStore.notify()
			await (target === parent ? updateEvent(target) : EntryStore.commit(target)).catch(() => void 0)
		} finally {
			applying--
		}
	}
}

/** Explicit entry point to offer closing subtasks from the task status popover. */
export async function offerToCloseSubtasksOf(entry: Entry) {
	const id = targetIdOf(entry)
	if (!id) {
		return
	}
	const view = await getEntryHierarchy(id).catch(() => undefined)
	if (view) {
		await offerToCloseSubtasks(entry, view.descendants)
	}
}

// --- Hierarchy-scoped gestures ------------------------------------------------------------------------

/** Deletes an entry and optionally its subtree (children deleted first to prevent orphaned subtasks). */
export async function deleteScoped(entry: Entry, scope: EntryScope) {
	if (scope.subtasks) {
		for (const descendant of await subtree(entry).catch(() => [])) {
			const target = trackedOr(descendant)
			await (target === descendant ? deleteEvent(target.id!) : EntryStore.delete(target, 'all')).catch(() => void 0)
		}
	}
	return EntryStore.delete(entry, scope.recurrence)
}

/** Shifts dated subtree entries by the gesture's time delta. Undated subtasks are skipped. */
export async function shiftSubtree(entry: Entry, deltaMs: number) {
	if (!deltaMs) {
		return
	}
	for (const descendant of await subtree(entry).catch(() => [])) {
		if (!descendant.start) {
			continue
		}
		const target = trackedOr(descendant)
		target.start = target.start!.add({ milliseconds: deltaMs })
		target.end = target.end?.add({ milliseconds: deltaMs })
		if (target === descendant) {
			await updateEvent(target).catch(() => void 0)
		} else {
			EntryStore.notify()
			await EntryStore.commit(target, 'all').catch(() => EntryStore.revert(target))
		}
	}
}

/** Injects dialog-driven hierarchy handlers into EntryStore at boot. */
export function installHierarchyPrompts() {
	EntryStore.onTaskClosed = entry => {
		if (applying === 0) {
			void offerFollowUps(entry).catch(() => void 0)
		}
	}
}

/** Resolves recurrence scope without hierarchy options for single-entry mutations. */
export function resolveRecurrenceScope(entry: Entry, intent: 'edit' | 'delete'): Promise<RecurrenceScope | undefined> {
	return new DialogEntryScope({ entry, intent, series: true, subtasks: 0 })
		.confirm()
		.then(scope => scope?.recurrence)
}
