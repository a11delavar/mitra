// By file, not the barrel: Entry imports this class, and TypeScript 7 drops the member from Entry in a file that also imports this one directly.
import type { Entry } from '#features/entries/Entry.js'
import type { EntryShift } from '#features/entries/EntryShift.js'
import { RelationGraph } from './RelationGraph.js'
import { ShiftStrategy } from './ShiftStrategy.js'
import type { EntryPlan } from './EntryPlan.js'

/**
 * Where an entry stands among the others: its subtasks and parents, what they add up to, what must finish before it and what
 * its moves pull along. Read off the graph of every entry around it, which the browser registers once ({@link EntryHierarchy.from},
 * the store's), as `@include` finds a source; where none is registered, as on the server, an entry stands alone.
 */
export class EntryHierarchy {
	private static graphs = () => RelationGraph.empty

	/** Where the graph of every entry is, which each entry's hierarchy reads. */
	static from(graph: () => RelationGraph) {
		EntryHierarchy.graphs = graph
	}

	constructor(private readonly entry: Entry) { }

	private get graph() {
		return EntryHierarchy.graphs()
	}

	private around(step: (graph: RelationGraph, uid: string) => Array<Entry>) {
		return this.entry.uid ? step(this.graph, this.entry.uid) : []
	}

	get children() {
		return this.around((graph, uid) => graph.childrenOf(uid))
	}

	get parents() {
		return this.around((graph, uid) => graph.parentsOf(uid))
	}

	get descendants() {
		return this.around((graph, uid) => graph.descendantsOf(uid))
	}

	/** What must finish before it. */
	get predecessors() {
		return this.around((graph, uid) => graph.predecessorsOf(uid))
	}

	/** The ancestors that completing this one completes, deepest first. */
	get completedAncestors() {
		return this.graph.ancestorsCompletedBy(this.entry.uid)
	}

	/** Its subtasks and checklist items added up, where it has any. */
	get rollup() {
		return this.graph.rollupOf(this.entry.uid)
	}

	/** The rollup's progress, else the entry's own. */
	get progress() {
		const rollup = this.rollup
		return rollup?.total ? rollup.progress : this.entry.progress
	}

	/** Whether this one can block `dependent`: both saved, the dependent's calendar keeping relations, and no dependency between the two yet, either way, direct or through others. */
	canBlock(dependent: Entry) {
		const predecessor = this.entry
		if (!predecessor.relatable || !dependent.relatable || predecessor.uid === dependent.uid || !dependent.holds('relations')) {
			return false
		}
		const coupled = (from: Entry, to: Entry) => this.graph.edgesFrom(from.uid!).some(edge => edge.family === 'dependency' && edge.to === to.uid)
		if (coupled(predecessor, dependent) || coupled(dependent, predecessor)) {
			return false
		}
		return !this.graph.reaches('dependency', [predecessor.uid!], dependent.uid!)
	}

	/** The distinct ways its dependents could follow `change`, none where every strategy agrees. */
	shiftOptions(change: EntryShift) {
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
