import type { Entry } from './Entry.js'

/** How a gesture moved an entry's span: the entry as it is now beside how it was. */
export class EntryShift {
	static of(entry: Entry, before: Entry | undefined) {
		return new EntryShift(entry, before)
	}

	private constructor(readonly entry: Entry, readonly before: Entry | undefined) { }

	/**
	 * Translation distance in milliseconds when both boundaries shifted identically; undefined for resizes.
	 */
	get delta(): number | undefined {
		const before = this.before
		if (!before?.start || !this.entry.start || !before.end !== !this.entry.end) {
			return undefined
		}
		const start = this.entry.start.valueOf() - before.start.valueOf()
		const end = before.end && this.entry.end ? this.entry.end.valueOf() - before.end.valueOf() : start
		return start === end && start !== 0 ? start : undefined
	}
}
