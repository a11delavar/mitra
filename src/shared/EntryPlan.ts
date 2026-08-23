import type { Entry } from './Entry.js'

/** The mutation is a function so the applier can run it on whichever instance it actually writes — the
 * live one the UI renders when present, the planned copy otherwise. */
export interface PlannedWrite {
	readonly entry: Entry
	readonly mutate: (entry: Entry) => void
}

/** Why an entry touched by a plan was skipped. Reported explicitly so unapplied indirect changes are never silent. */
export interface SkippedEntry {
	readonly entry: Entry
	readonly reason: 'undated' | 'repeats' | 'unresolvable'
}

/**
 * A proposed set of indirect entry changes derived from the relationship graph. Value object: deriving
 * writes nothing, letting callers derive and compare plans via {@link equals} to avoid redundant dialog choices.
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

	/** Compares target entry IDs and application order. Mutations are compared by target entry rather than callback identity. */
	equals(other: EntryPlan): boolean {
		const shape = (plan: EntryPlan) => `${plan.deletions.map(entry => entry.id).join()}|${plan.writes.map(write => write.entry.id).join()}`
		return shape(this) === shape(other)
	}
}
