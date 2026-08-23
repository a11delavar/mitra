import { type Entry, type EntryChange, EntryPlan, type PlannedWrite, type RecurrenceScope, type ShiftStrategy, type SkippedEntry, TaskStatus } from 'shared'
import { EntryStore } from './EntryStore.js'
import { Relations } from './Relations.js'
import { DialogEntryScope, type EntryScope } from './components/DialogEntryScope.js'
import { DialogCompleteParent } from './components/DialogCompleteParent.js'
import { DialogCloseSubtasks } from './components/DialogCloseSubtasks.js'

/**
 * Hierarchy actions and prompt workflows. Computations use {@link Relations} and writes execute via {@link EntryStore.applyPlan}.
 */

export function subtreeSize(entry: Entry): number {
	return Relations.descendantsOf(entry).length
}

/**
 * Resolves gesture scope across recurrence, hierarchy, and dependency axes.
 */
export function resolveScope(entry: Entry, intent: 'edit' | 'move' | 'delete', bypass = false, hasSubtaskAction = true, change?: EntryChange): Promise<EntryScope | undefined> {
	const series = !!entry.recurrenceMasterId
	const subtasks = hasSubtaskAction && (intent === 'delete' || intent === 'move') ? subtreeSize(entry) : 0
	const shifts = change && intent !== 'delete' ? Relations.shiftOptionsFor(change) : []
	if (bypass || (!series && !subtasks && shifts.length < 2)) {
		return Promise.resolve({ recurrence: series ? 'this' as const : undefined, subtasks: false })
	}
	return new DialogEntryScope({ entry, intent, series, subtasks, shifts }).confirm().catch(() => undefined)
}

/**
 * Applies shift strategy to downstream entries, excluding entries already modified.
 */
export function shiftDependents(change: EntryChange, strategy: ShiftStrategy, already = EntryPlan.empty) {
	const plan = strategy.plan(Relations.graph, change).excluding(already)
	return plan.isEmpty ? Promise.resolve(undefined) : EntryStore.applyPlan(plan)
}

// --- Follow-up offers ---------------------------------------------------------------------------------

/** Depth of active plan application, preventing recursive follow-up prompts. */
let applying = 0

/** Set of entry IDs currently prompting to avoid duplicate dialogs. */
const offering = new Set<string>()

const targetIdOf = (entry: Entry) => entry.recurrenceMasterId ?? entry.id

/** Prompts follow-up actions (subtask closure downwards, then parent completion upwards) when a task is closed. */
export async function offerFollowUps(entry: Entry) {
	const id = targetIdOf(entry)
	if (!id || !entry.type.isTask || offering.has(id)) {
		return
	}
	offering.add(id)
	try {
		// Downwards first so parent prompts don't query a tree in the middle of resolving.
		await offerToCloseSubtasks(entry)
		await offerToCompleteParents(entry)
	} finally {
		offering.delete(id)
	}
}

/** Prompts to close remaining open direct subtasks when a parent task is closed. */
export async function offerToCloseSubtasks(entry: Entry) {
	const outstanding = Relations.childrenOf(entry).filter(child => child.type.isTask && !child.closed)
	if (!outstanding.length) {
		return
	}
	const closure = await new DialogCloseSubtasks({ entry, outstanding: outstanding.length }).confirm().catch(() => undefined)
	if (!closure) {
		return
	}
	await run(EntryPlan.of({
		writes: outstanding.map(child => ({
			entry: child,
			mutate: (target: Entry) => {
				target.status = closure
				// RFC 5545 §3.8.1.8: percent-complete is 100 on Done; Cancelled retains its progress.
				if (closure === TaskStatus.Done) {
					target.percentComplete = 100
				}
			},
		})),
	}))
}

/** Prompts to complete ancestor tasks when completing the final subtask resolves them. */
async function offerToCompleteParents(closed: Entry) {
	const parents = Relations.ancestorsCompletedBy(closed)
	if (!parents.length) {
		return
	}
	if (!await new DialogCompleteParent({ parents }).confirm().catch(() => undefined)) {
		return
	}
	await run(EntryPlan.of({
		// Deepest first so intermediate states remain valid.
		writes: parents.map(parent => ({
			entry: parent,
			mutate: (target: Entry) => {
				target.status = TaskStatus.Done
				target.percentComplete = 100
			},
		})),
	}))
}

/** Executes an offer's EntryPlan with prompt re-entrancy tracking. */
async function run(plan: EntryPlan) {
	applying++
	try {
		return await EntryStore.applyPlan(plan)
	} finally {
		applying--
	}
}

// --- Hierarchy-scoped gestures ------------------------------------------------------------------------

/** Deletes an entry and optionally its subtree in deepest-first order. */
export async function deleteScoped(entry: Entry, scope: EntryScope) {
	if (scope.subtasks) {
		await EntryStore.applyPlan(EntryPlan.of({ deletions: [...Relations.descendantsOf(entry)].reverse() }))
	}
	return EntryStore.delete(entry, scope.recurrence)
}

/** Shifts dated subtree entries by time delta. Undated subtasks are recorded as skipped. Answers the
 * plan it applied, so a following consequence of the same gesture can leave those entries alone. */
export async function shiftSubtree(entry: Entry, deltaMs: number): Promise<EntryPlan> {
	if (!deltaMs) {
		return EntryPlan.empty
	}
	const writes = new Array<PlannedWrite>()
	const skipped = new Array<SkippedEntry>()
	for (const descendant of Relations.descendantsOf(entry)) {
		if (!descendant.start) {
			skipped.push({ entry: descendant, reason: 'undated' })
			continue
		}
		writes.push({
			entry: descendant,
			mutate: (target: Entry) => {
				target.start = target.start?.add({ milliseconds: deltaMs })
				target.end = target.end?.add({ milliseconds: deltaMs })
			},
		})
	}
	const plan = EntryPlan.of({ writes, skipped })
	await EntryStore.applyPlan(plan)
	return plan
}

/** Injects hierarchy follow-up prompts into EntryStore task completion lifecycle. */
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
		.catch(() => undefined)
		.then(scope => scope?.recurrence)
}
