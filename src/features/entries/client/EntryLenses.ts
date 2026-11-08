import { type EntryOccurrence } from '#features/recurrence'

/** What keeps some occurrences off every surface, as the hide-done setting does. */
export type EntryLens = (occurrences: ReadonlyArray<EntryOccurrence>) => ReadonlyArray<EntryOccurrence>

/** The lenses every surface draws through, each registered once by what decides it; search and rollups still see past them. */
export class EntryLenses {
	private readonly lenses = new Set<EntryLens>()

	/** Draws every surface through `lens` too, until the function it answers is called. */
	add(lens: EntryLens) {
		this.lenses.add(lens)
		return () => void this.lenses.delete(lens)
	}

	/** What `occurrences` leave once every lens kept its share out. */
	apply(occurrences: ReadonlyArray<EntryOccurrence>) {
		return [...this.lenses].reduce((shown, lens) => lens(shown), occurrences)
	}
}
