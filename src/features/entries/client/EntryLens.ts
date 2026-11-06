import type { Entry } from '../Entry.js'
import type { EntryOccurrence } from '#features/recurrence'
import { EntryEditorIntent } from './EntryEditorIntent.js'

/**
 * What a hide setting keeps out of the surfaces that draw entries. The entries stay fetched and whole: search, progress
 * rollups and the sync engine never see a lens.
 */
export class EntryLens {
	private readonly filtered = new WeakMap<ReadonlyArray<EntryOccurrence>, { hidden: boolean, result: ReadonlyArray<EntryOccurrence> }>()

	constructor(private readonly hides: (entry: Entry) => boolean) { }

	/** Whether a surface draws this occurrence. What the lens hides remains visible while its editor is active. */
	shows(occurrence: EntryOccurrence, hidden: boolean) {
		return !hidden || !this.hides(occurrence.entry) || EntryEditorIntent.holds(occurrence)
	}

	/** Filters occurrences for display, memoized on input array identity, and untouched while the lens is off. */
	filter(occurrences: ReadonlyArray<EntryOccurrence>, hidden: boolean): ReadonlyArray<EntryOccurrence> {
		const cached = this.filtered.get(occurrences)
		if (cached?.hidden === hidden) {
			return cached.result
		}
		const result = !hidden ? occurrences : occurrences.filter(occurrence => this.shows(occurrence, hidden))
		this.filtered.set(occurrences, { hidden, result })
		return result
	}
}
