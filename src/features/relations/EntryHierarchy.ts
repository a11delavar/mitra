// By file, not the barrel: Entry imports this class, and TypeScript 7 drops the member from Entry in a file that also imports this one directly.
import type { Entry } from '#features/entries/Entry.js'
import type { EntryShift } from '#features/entries/EntryShift.js'
import { TaskStatus } from '#features/entries/TaskStatus.js'
import { RelationGraph } from './RelationGraph.js'
import { ShiftStrategy } from './ShiftStrategy.js'
import { EntryPlan, type PlannedWrite, type SkippedEntry } from './EntryPlan.js'

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
		return this.around((graph, uid) => graph.getChildren(uid))
	}

	get parents() {
		return this.around((graph, uid) => graph.getParents(uid))
	}

	get descendants() {
		return this.around((graph, uid) => graph.getDescendants(uid))
	}

	/** What must finish before it. */
	get predecessors() {
		return this.around((graph, uid) => graph.getPredecessors(uid))
	}

	/** The ancestors that completing this one completes, deepest first. */
	get completedAncestors() {
		return this.graph.getAncestorsCompletedBy(this.entry.uid)
	}

	/** Its subtasks and checklist items added up, where it has any. */
	get rollup() {
		return this.graph.getRollup(this.entry.uid)
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
		const coupled = (from: Entry, to: Entry) => this.graph.getEdgesFrom(from.uid!).some(edge => edge.family === 'dependency' && edge.to === to.uid)
		if (coupled(predecessor, dependent) || coupled(dependent, predecessor)) {
			return false
		}
		return !this.graph.reaches('dependency', [predecessor.uid!], dependent.uid!)
	}

	/** Its subtree moved by `milliseconds`: the dated descendants, the undated ones skipped. */
	planShift(milliseconds: number) {
		if (!milliseconds) {
			return EntryPlan.empty
		}
		const writes = new Array<PlannedWrite>()
		const skipped = new Array<SkippedEntry>()
		for (const descendant of this.descendants) {
			if (!descendant.start) {
				skipped.push({ entry: descendant, reason: 'undated' })
				continue
			}
			writes.push({
				entry: descendant,
				mutate: (target: Entry) => {
					target.start = target.start?.add({ milliseconds })
					target.end = target.end?.add({ milliseconds })
				},
			})
		}
		return EntryPlan.of({ writes, skipped })
	}

	/** Its subtree deleted, deepest first. */
	planDeletion() {
		return EntryPlan.of({ deletions: [...this.descendants].reverse() })
	}

	/** Its open subtasks closed as `status`, as closing it offers. */
	planClosing(status: TaskStatus) {
		return EntryPlan.of({
			writes: this.children.filter(child => child.open).map(child => ({
				entry: child,
				mutate: (target: Entry) => { target.status = status },
			})),
		})
	}

	/** The parents completing it completes, done, deepest first so each state between stays valid. */
	planCompletion() {
		return EntryPlan.of({
			writes: this.completedAncestors.map(parent => ({
				entry: parent,
				mutate: (target: Entry) => { target.status = TaskStatus.Done },
			})),
		})
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
