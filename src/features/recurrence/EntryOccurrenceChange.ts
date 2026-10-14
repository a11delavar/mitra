import { type EntityManager } from '@mikro-orm/core'
import { type Entry } from '../entries/Entry.js'
import { type Integration } from '../../integrations/Integration.js'

/** Which of an entry's occurrences an edit or delete through one of them reaches. */
export type EntryOccurrenceChangeScope = 'this' | 'following' | 'all'

/** What an edit or delete through an occurrence does to its recurring entry. */
export class EntryOccurrenceChange {
	readonly entry!: Entry
	/** The recurring entry as it stands afterwards; in another calendar, it moves there. */
	readonly rewritten?: Entry
	/** The date it no longer yields. */
	readonly excluded?: Date
	/** An entry of its own: the occurrence that left, or the rule from it on. */
	readonly created?: Entry
	/** Whether the recurring entry goes entirely. */
	readonly removed?: boolean

	constructor(init: Pick<EntryOccurrenceChange, 'entry'> & Partial<EntryOccurrenceChange>) {
		Object.assign(this, init)
	}

	/** Writes the change, an entry for another calendar into `to`. Answers with the entry the occurrence now belongs to. */
	async save(em: EntityManager, from: Integration, to = from): Promise<Entry> {
		const { entry, rewritten, excluded, created, removed } = this
		if (removed) {
			await from.deleteEntry(em, entry)
			return entry
		}
		if (excluded) {
			await from.excludeOccurrence(em, entry, excluded)
		}
		if (rewritten && rewritten.sourceId !== entry.sourceId) {
			// Create first, so a failure loses nothing.
			const moved = await to.createEntry(em, rewritten)
			try {
				await from.deleteEntry(em, entry)
			} catch (error) {
				await to.deleteEntry(em, moved).catch(() => void 0)
				throw error
			}
			return moved
		}
		if (rewritten) {
			await from.updateEntry(em, entry, rewritten)
		}
		return created ? to.createEntry(em, created) : entry
	}
}
