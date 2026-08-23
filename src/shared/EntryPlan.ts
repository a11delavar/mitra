import type { Entry } from './Entry.js'

/** Mutates an entry instance as planned. */
export interface PlannedWrite {
	readonly entry: Entry
	readonly mutate: (entry: Entry) => void
	/** Descriptive effect or offset distinguishing mutation variants on the same entry. */
	readonly effect?: string
}

/** Why an entry touched by a plan was skipped. */
export interface SkippedEntry {
	readonly entry: Entry
	readonly reason: 'undated' | 'repeats' | 'unresolvable'
}

/**
 * Proposed set of entry changes derived from the relationship graph.
 */
export class EntryPlan {
	static readonly empty = new EntryPlan([], [], [])

	static of(init: { writes?: ReadonlyArray<PlannedWrite>, deletions?: ReadonlyArray<Entry>, skipped?: ReadonlyArray<SkippedEntry> }): EntryPlan {
		return new EntryPlan(init.writes ?? [], init.deletions ?? [], init.skipped ?? [])
	}

	private constructor(
		readonly writes: ReadonlyArray<PlannedWrite>,
		/** Applied before writes, deepest first, so failures never leave orphaned subtrees. */
		readonly deletions: ReadonlyArray<Entry>,
		readonly skipped: ReadonlyArray<SkippedEntry>,
	) { }

	get isEmpty() {
		return !this.writes.length && !this.deletions.length
	}

	get count() {
		return this.writes.length + this.deletions.length
	}

	get entries(): ReadonlyArray<Entry> {
		return [...this.deletions, ...this.writes.map(write => write.entry)]
	}

	/** Returns this plan excluding entries already covered by another plan. */
	excluding(other: EntryPlan): EntryPlan {
		const covered = new Set(other.entries)
		return EntryPlan.of({
			writes: this.writes.filter(write => !covered.has(write.entry)),
			deletions: this.deletions.filter(entry => !covered.has(entry)),
			skipped: this.skipped,
		})
	}

	/** Checks if two plans perform the same operations on the same entries. */
	equals(other: EntryPlan): boolean {
		const shape = (plan: EntryPlan) => `${plan.deletions.map(entry => entry.id).join()}|${plan.writes.map(write => `${write.entry.id}:${write.effect ?? ''}`).join()}`
		return shape(this) === shape(other)
	}
}
