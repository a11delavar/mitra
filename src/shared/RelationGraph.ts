import { type Entry, type EntryRollup, TaskStatus } from './Entry.js'
import { EntryRelations } from './EntryRelations.js'
import type { RelationInit } from './Relation.js'
import type { RelationEdge } from './RelationEdge.js'

/** Maximum traversal depth to prevent infinite loops from unsanitized external graph cycles. */
const MAX_DEPTH = 50

/**
 * Directed relationship graph over a set of entries. Computes descendants, ancestors, rollups,
 * dependents, and cycle detection. Nodes are keyed by UID; series masters represent occurrences
 * unless the master is absent. Targets may dangle if unreferenced entries are omitted.
 */
export class RelationGraph {
	static readonly empty = new RelationGraph([])

	/** Builds the graph over entries. `relationsOf` allows passing relation rows directly (e.g. on the
	 * server to omit rows being replaced during cycle validation). */
	static of(entries: Iterable<Entry>, relationsOf: (entry: Entry) => Iterable<RelationInit> | null | undefined = entry => entry.relations): RelationGraph {
		const identified = [...entries].filter(entry => !!entry.uid)
		const masters = new Set(identified.filter(entry => !entry.recurrenceId).map(entry => entry.uid!))
		return new RelationGraph(identified.filter(entry => !entry.recurrenceId || !masters.has(entry.uid!)), relationsOf)
	}

	private readonly entriesByUid = new Map<string, Entry>()
	private readonly edgesByKey = new Map<string, RelationEdge>()
	private readonly outgoing = new Map<string, Array<RelationEdge>>()
	private readonly incoming = new Map<string, Array<RelationEdge>>()
	private readonly rollups = new Map<string, EntryRollup | undefined>()

	private constructor(entries: ReadonlyArray<Entry>, relationsOf: (entry: Entry) => Iterable<RelationInit> | null | undefined = entry => entry.relations) {
		for (const entry of entries) {
			// First entry per UID wins, allowing callers to overlay local working copies over fetched rows.
			if (!this.entriesByUid.has(entry.uid!)) {
				this.entriesByUid.set(entry.uid!, entry)
			}
		}
		for (const entry of entries) {
			// Traverses through EntryRelations to respect line direction and prevent inverted edge creation.
			for (const edge of EntryRelations.of(entry.uid, relationsOf(entry)).edges) {
				if (edge.from === edge.to || this.edgesByKey.has(edge.key)) {
					continue
				}
				this.edgesByKey.set(edge.key, edge)
				this.outgoing.set(edge.from, [...this.outgoing.get(edge.from) ?? [], edge])
				this.incoming.set(edge.to, [...this.incoming.get(edge.to) ?? [], edge])
			}
		}
	}

	get edges(): ReadonlyArray<RelationEdge> {
		return [...this.edgesByKey.values()]
	}

	get entries(): ReadonlyArray<Entry> {
		return [...this.entriesByUid.values()]
	}

	entryOf(uid: string | undefined) {
		return uid === undefined ? undefined : this.entriesByUid.get(uid)
	}

	edgesFrom(uid: string): ReadonlyArray<RelationEdge> {
		return this.outgoing.get(uid) ?? []
	}

	edgesTo(uid: string): ReadonlyArray<RelationEdge> {
		return this.incoming.get(uid) ?? []
	}

	childrenOf(uid: string) { return this.resolve(this.step(uid, 'hierarchy', 'down')) }
	parentsOf(uid: string) { return this.resolve(this.step(uid, 'hierarchy', 'up')) }
	dependentsOf(uid: string) { return this.resolve(this.step(uid, 'dependency', 'down')) }
	predecessorsOf(uid: string) { return this.resolve(this.step(uid, 'dependency', 'up')) }

	descendantsOf(uid: string) { return this.resolve(this.walk(this.step(uid, 'hierarchy', 'down'), 'hierarchy', 'down', uid)) }
	ancestorsOf(uid: string) { return this.resolve(this.walk(this.step(uid, 'hierarchy', 'up'), 'hierarchy', 'up', uid)) }
	downstreamOf(uid: string) { return this.resolve(this.walk(this.step(uid, 'dependency', 'down'), 'dependency', 'down', uid)) }
	/** Everything this entry waits for, transitively. */
	upstreamOf(uid: string) { return this.resolve(this.walk(this.step(uid, 'dependency', 'up'), 'dependency', 'up', uid)) }

	/** Checks if walking upwards from candidate seeds reaches target, detecting directed cycles. */
	reaches(family: 'hierarchy' | 'dependency', seeds: Iterable<string>, target: string): boolean {
		return this.walk([...new Set(seeds)], family, 'up').includes(target)
	}

	/** Computes subtask progress rollup, memoized per graph. Cancelled tasks are omitted from the
	 * denominator, and progress is weighted recursively by child rollups or authored percentComplete. */
	rollupOf(uid: string | undefined, visiting = new Set<string>()): EntryRollup | undefined {
		if (uid === undefined || visiting.has(uid)) {
			return undefined
		}
		if (this.rollups.has(uid)) {
			return this.rollups.get(uid)
		}
		visiting.add(uid)
		const children = this.childrenOf(uid)
		if (!children.length) {
			this.rollups.set(uid, undefined)
			return undefined
		}
		const tasks = children.filter(child => child.type.isTask && child.status !== TaskStatus.Cancelled)
		const done = tasks.filter(child => child.status === TaskStatus.Done).length
		const progressSum = tasks.reduce((sum, child) => {
			if (child.status === TaskStatus.Done) {
				return sum + 1
			}
			const rollup = this.rollupOf(child.uid, new Set(visiting))
			if (rollup?.total) {
				return sum + rollup.progress
			}
			return child.percentComplete === null || child.percentComplete === undefined ? sum : sum + child.percentComplete / 100
		}, 0)
		const rollup: EntryRollup = {
			done,
			total: tasks.length,
			progress: tasks.length ? progressSum / tasks.length : 0,
			children: children.length,
			descendants: this.descendantsOf(uid).length,
		}
		this.rollups.set(uid, rollup)
		return rollup
	}

	/** Returns ancestors that become completed when completing this entry, ordered deepest-first.
	 * An ancestor completes when all non-cancelled task children are closed or part of the chain. */
	ancestorsCompletedBy(uid: string | undefined): Array<Entry> {
		const subject = this.entryOf(uid)
		if (!subject) {
			return []
		}
		const closing = new Set<Entry>([subject])
		const found = new Array<Entry>()
		let frontier: ReadonlyArray<Entry> = [subject]
		for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
			const next = new Array<Entry>()
			for (const node of frontier) {
				for (const parent of this.parentsOf(node.uid!)) {
					if (!parent.type.isTask || parent.closed || closing.has(parent)) {
						continue
					}
					const children = this.childrenOf(parent.uid!).filter(child => child.type.isTask && child.status !== TaskStatus.Cancelled)
					if (!children.length || !children.every(child => child.closed || closing.has(child))) {
						continue
					}
					closing.add(parent)
					found.push(parent)
					next.push(parent)
				}
			}
			frontier = next
		}
		return found
	}

	/** Breadth-first walk bounded by visited set and MAX_DEPTH. */
	private walk(seeds: ReadonlyArray<string>, family: 'hierarchy' | 'dependency', towards: 'up' | 'down', origin?: string): Array<string> {
		// Origin is pre-marked visited to prevent reporting an entry as its own descendant in cyclic graphs.
		const visited = new Set<string>(origin === undefined ? [] : [origin])
		const found = new Array<string>()
		let frontier = seeds
		for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
			const next = new Array<string>()
			for (const uid of frontier) {
				if (visited.has(uid)) {
					continue
				}
				visited.add(uid)
				found.push(uid)
				next.push(...this.step(uid, family, towards))
			}
			frontier = next
		}
		return found
	}

	private step(uid: string, family: 'hierarchy' | 'dependency', towards: 'up' | 'down'): Array<string> {
		return towards === 'down'
			? this.edgesFrom(uid).filter(edge => edge.family === family).map(edge => edge.to)
			: this.edgesTo(uid).filter(edge => edge.family === family).map(edge => edge.from)
	}

	private resolve(uids: ReadonlyArray<string>): Array<Entry> {
		return uids.map(uid => this.entriesByUid.get(uid)).filter((entry): entry is Entry => !!entry)
	}
}
