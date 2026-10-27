import { type EntryShift, type Entry } from '#features/entries'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { DialogEntryScope, type EntryScope } from '#features/entries/client/DialogEntryScope.js'
import { EntryOccurrenceChangeScope } from '#features/recurrence'
import { type ShiftStrategy } from '../ShiftStrategy.js'
import { EntryPlan } from '../EntryPlan.js'
import { DialogCompleteParent } from './DialogCompleteParent.js'
import { DialogCloseSubtasks } from './DialogCloseSubtasks.js'

/**
 * What a gesture on an entry asks and pulls along in the browser: the scope it reaches across its series, subtree and
 * dependents, and the follow-ups offered once a task closes. The plans are the entry's own (`entry.hierarchy`); this asks
 * about them and applies them through the store.
 */
export class Hierarchy {
	/** How many plans of its own are being applied, so the tasks they close offer nothing again. */
	private applying = 0

	/** The entries whose follow-ups are being offered, so a second closing asks no second time. */
	private readonly offering = new Set<string>()

	/** Offers the follow-ups whenever a task the store saves closes; answers how to stop. */
	listen() {
		return EntryStore.whenTaskCloses(entry => {
			if (this.applying === 0) {
				void this.offerFollowUps(entry).catch(() => void 0)
			}
		})
	}

	/** Resolves gesture scope across recurrence, hierarchy, and dependency axes. */
	resolveScope(entry: Entry, intent: 'edit' | 'move' | 'delete', bypass = false, hasSubtaskAction = true, change?: EntryShift): Promise<EntryScope | undefined> {
		const series = !!entry.recurringEntryId
		const subtasks = hasSubtaskAction && (intent === 'delete' || intent === 'move') ? entry.hierarchy.descendants.length : 0
		const shifts = change && intent !== 'delete' ? entry.hierarchy.shiftOptions(change) : []
		if (bypass || (!series && !subtasks && shifts.length < 2)) {
			return Promise.resolve({ recurrence: series ? EntryOccurrenceChangeScope.This : undefined, subtasks: false })
		}
		return new DialogEntryScope({ entry, intent, series, subtasks, shifts }).confirm().catch(() => undefined)
	}

	/** Resolves recurrence scope without hierarchy options for single-entry mutations. */
	resolveRecurrenceScope(entry: Entry, intent: 'edit' | 'delete'): Promise<EntryOccurrenceChangeScope | undefined> {
		return new DialogEntryScope({ entry, intent, series: true, subtasks: 0 })
			.confirm()
			.catch(() => undefined)
			.then(scope => scope?.recurrence)
	}

	/** Applies shift strategy to downstream entries, excluding entries already modified. */
	shiftDependents(change: EntryShift, strategy: ShiftStrategy, already = EntryPlan.empty) {
		const plan = strategy.plan(EntryStore.graph, change).excluding(already)
		return plan.isEmpty ? Promise.resolve(undefined) : EntryStore.applyPlan(plan)
	}

	/** Moves the entry's dated subtree by `milliseconds`, answering the plan applied, so a following consequence of the same gesture can leave those entries alone. */
	async shiftSubtree(entry: Entry, milliseconds: number) {
		const plan = entry.hierarchy.planShift(milliseconds)
		await EntryStore.applyPlan(plan)
		return plan
	}

	/** Deletes an entry, and its subtree first where the scope reaches it. */
	async deleteScoped(entry: Entry, scope: EntryScope) {
		if (scope.subtasks) {
			await EntryStore.applyPlan(entry.hierarchy.planDeletion())
		}
		return EntryStore.delete(entry, scope.recurrence)
	}

	/** Offers what closing a task leads to: closing its open subtasks, then completing the parents it completes. */
	async offerFollowUps(entry: Entry) {
		const id = entry.recurringEntryId ?? entry.id
		if (!id || !entry.type.isTask || this.offering.has(id)) {
			return
		}
		this.offering.add(id)
		try {
			// Downwards first, so the parents' offer reads a tree no longer changing.
			await this.offerToCloseSubtasks(entry)
			await this.offerToCompleteParents(entry)
		} finally {
			this.offering.delete(id)
		}
	}

	/** Offers to close the open subtasks of a closed task. */
	async offerToCloseSubtasks(entry: Entry) {
		const outstanding = entry.hierarchy.children.filter(child => child.open).length
		if (!outstanding) {
			return
		}
		const status = await new DialogCloseSubtasks({ entry, outstanding }).confirm().catch(() => undefined)
		if (status) {
			await this.apply(entry.hierarchy.planClosing(status))
		}
	}

	/** Offers to complete the parents that completing this subtask completes. */
	private async offerToCompleteParents(closed: Entry) {
		const parents = closed.hierarchy.completedAncestors
		if (parents.length && await new DialogCompleteParent({ parents }).confirm().catch(() => undefined)) {
			await this.apply(closed.hierarchy.planCompletion())
		}
	}

	private async apply(plan: EntryPlan) {
		this.applying++
		try {
			return await EntryStore.applyPlan(plan)
		} finally {
			this.applying--
		}
	}
}

export const hierarchy = new Hierarchy()
