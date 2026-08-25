import { ShiftStrategy } from '../ShiftStrategy.js'
import { RelationGraph } from '../RelationGraph.js'
import { type EntryPlan } from '../EntryPlan.js'
import { type EntryChange } from '../../entries/EntryChange.js'
import { type Entry, type EntryRollup } from '../../entries/Entry.js'
import { getCapabilities, getRelationClosure } from '../../../infrastructure/http/Api.js'
import { EntryStore } from '../../entries/client/EntryStore.js'

/**
 * Client-side relationship manager. Combines window-independent relation closure entries with
 * the live EntryStore to provide reactive graph queries and rollups.
 */
export class Relations {
	private static closure: ReadonlyArray<Entry> = []
	private static cached?: RelationGraph
	/** Tracked entries reference used to invalidate cached RelationGraph on store notifications. */
	private static cachedFor?: ReadonlyArray<Entry>

	/** Indicates whether relation closure has loaded at least once to distinguish pending data from dangling links. */
	static loaded = false

	static get graph(): RelationGraph {
		const entries = EntryStore.entries
		if (!this.cached || this.cachedFor !== entries) {
			this.cached = RelationGraph.of([...entries, ...this.closure])
			this.cachedFor = entries
		}
		return this.cached
	}

	/** Refetches the relation closure on server update notifications. */
	static async refresh(): Promise<void> {
		this.closure = await getRelationClosure()
		this.loaded = true
		this.cached = undefined
		EntryStore.notify()
	}

	static entryOf(uid: string | undefined) {
		return this.graph.entryOf(uid)
	}

	static rollupOf(entry: Entry | undefined): EntryRollup | undefined {
		return this.graph.rollupOf(entry?.uid)
	}

	static progressOf(entry: Entry | undefined): number | undefined {
		const rollup = this.rollupOf(entry)
		return rollup?.total ? rollup.progress : entry?.progress
	}

	static isDerived(entry: Entry | undefined): boolean {
		return !!this.rollupOf(entry)?.total
	}

	static childrenOf(entry: Entry | undefined): Array<Entry> {
		return entry?.uid ? this.graph.childrenOf(entry.uid) : []
	}

	static parentsOf(entry: Entry | undefined): Array<Entry> {
		return entry?.uid ? this.graph.parentsOf(entry.uid) : []
	}

	static ancestorsCompletedBy(entry: Entry | undefined): Array<Entry> {
		return this.graph.ancestorsCompletedBy(entry?.uid)
	}

	static descendantsOf(entry: Entry | undefined): Array<Entry> {
		return entry?.uid ? this.graph.descendantsOf(entry.uid) : []
	}

	/**
	 * Whether a finish-to-start dependency from predecessor to dependent can be created.
	 */
	static canBlock(predecessor: Entry, dependent: Entry): boolean {
		if (!predecessor.relatable || !dependent.relatable || predecessor.uid === dependent.uid) {
			return false
		}
		if (!getCapabilities(dependent.sourceId).relations) {
			return false
		}
		const coupled = (from: Entry, to: Entry) => this.graph.edgesFrom(from.uid!).some(edge => edge.family === 'dependency' && edge.to === to.uid)
		if (coupled(predecessor, dependent) || coupled(dependent, predecessor)) {
			return false
		}
		return !this.graph.reaches('dependency', [predecessor.uid!], dependent.uid!)
	}

	/**
	 * Evaluates distinct shift options for downstream entries, deduplicating equivalent plans.
	 */
	static shiftOptionsFor(change: EntryChange): Array<{ strategy: ShiftStrategy, plan: EntryPlan }> {
		const options = new Array<{ strategy: ShiftStrategy, plan: EntryPlan }>()
		for (const strategy of ShiftStrategy.all) {
			const plan = strategy.plan(this.graph, change)
			if (!options.some(option => option.plan.equals(plan))) {
				options.push({ strategy, plan })
			}
		}
		return options.length > 1 ? options : []
	}
}
