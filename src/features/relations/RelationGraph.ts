import { type Entry, type EntryRollup } from '../entries/Entry.js'
import { TaskStatus } from '../entries/TaskStatus.js'
import { EntryRelations } from './EntryRelations.js'
import type { RelationEdge } from './RelationEdge.js'

/** Maximum traversal depth to prevent infinite loops from unsanitized external graph cycles. */
const MAX_DEPTH = 50

/** Directed relationship graph keyed by UID, where a master stands for its occurrences unless absent. Targets may dangle. */
export class RelationGraph {
	static readonly empty = new RelationGraph([])

	/** Builds the graph over entries and the ones their relations hold at the other ends, however deep. `relationsOf` allows
	 * passing relation rows directly (e.g. on the server to omit rows being replaced during cycle validation). */
	static of(entries: Iterable<Entry>, relationsOf: (entry: Entry) => EntryRelations | undefined = entry => entry.relations): RelationGraph {
		// A read nests the targets as a tree, so the descent ends.
		const withTargets = (entry: Entry): Array<Entry> => [entry, ...(relationsOf(entry)?.all ?? []).flatMap(relation => relation.target ? withTargets(relation.target) : [])]
		const identified = [...new Set([...entries].flatMap(withTargets))].filter(entry => !!entry.uid)
		const masters = new Set(identified.filter(entry => !entry.recurrenceId).map(entry => entry.uid!))
		return new RelationGraph(identified.filter(entry => !entry.recurrenceId || !masters.has(entry.uid!)), relationsOf)
	}

	private readonly entriesByUid = new Map<string, Entry>()
	private readonly edgesByKey = new Map<string, RelationEdge>()
	private readonly outgoing = new Map<string, Array<RelationEdge>>()
	private readonly incoming = new Map<string, Array<RelationEdge>>()
	private readonly rollups = new Map<string, EntryRollup | undefined>()

	private constructor(entries: ReadonlyArray<Entry>, relationsOf: (entry: Entry) => EntryRelations | undefined = entry => entry.relations) {
		for (const entry of entries) {
			// First entry per UID wins, allowing callers to overlay local working copies over fetched rows.
			if (!this.entriesByUid.has(entry.uid!)) {
				this.entriesByUid.set(entry.uid!, entry)
			}
		}
		for (const entry of entries) {
			// Traverses through EntryRelations to respect line direction and prevent inverted edge creation.
			for (const edge of (relationsOf(entry) ?? EntryRelations.none).edges(entry.uid)) {
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

	/** The entries joined to `uids` by any chain of edges, whichever way each points, theirs included. */
	connectedTo(uids: Iterable<string>): Array<Entry> {
		const reach = (frontier: ReadonlyArray<string>, visited: ReadonlySet<string>): ReadonlySet<string> => {
			const fresh = [...new Set(frontier)].filter(uid => !visited.has(uid))
			return !fresh.length ? visited : reach(
				fresh.flatMap(uid => [...this.edgesFrom(uid).map(edge => edge.to), ...this.edgesTo(uid).map(edge => edge.from)]),
				new Set([...visited, ...fresh]),
			)
		}
		return this.resolve([...reach([...uids], new Set())])
	}

	/** Checks if walking upwards from candidate seeds reaches target, detecting directed cycles. */
	reaches(family: 'hierarchy' | 'dependency', seeds: Iterable<string>, target: string): boolean {
		return this.walk([...new Set(seeds)], family, 'up').includes(target)
	}

	/** Subtasks and description checklist items weigh equally; cancelled subtasks are excluded. */
	rollupOf(uid: string | undefined, visiting = new Set<string>()): EntryRollup | undefined {
		if (uid === undefined || visiting.has(uid)) {
			return undefined
		}
		if (this.rollups.has(uid)) {
			return this.rollups.get(uid)
		}
		visiting.add(uid)
		const subject = this.entryOf(uid)
		const checklist = subject?.type.isTask ? subject.checklist : undefined
		const children = this.childrenOf(uid)
		if (!children.length && !checklist?.total) {
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
			return child.percentComplete === undefined ? sum : sum + child.percentComplete / 100
		}, 0)
		const ticked = checklist?.done ?? 0
		const boxes = checklist?.total ?? 0
		const total = tasks.length + boxes
		const rollup: EntryRollup = {
			done: done + ticked,
			total,
			progress: total ? (progressSum + ticked) / total : 0,
			subtasks: { done, total: tasks.length },
			checklist: { done: ticked, total: boxes },
			children: children.length,
			descendants: this.descendantsOf(uid).length,
		}
		this.rollups.set(uid, rollup)
		return rollup
	}

	/** Ancestors that completing this entry completes, deepest first: each needs every non-cancelled task child closed and its checklist ticked. */
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
					const checklist = parent.checklist
					if (checklist.done < checklist.total) {
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
