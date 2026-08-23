import { type Entry, type EntryRollup, RelationGraph } from 'shared'
import { getRelationClosure } from './Api.js'
import { EntryStore } from './EntryStore.js'

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
}
