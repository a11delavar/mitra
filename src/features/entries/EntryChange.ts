import { type EntityManager } from '@mikro-orm/core'
import { type Entry } from './Entry.js'
import { type Calendar } from '../sources/Calendar.js'

/**
 * What an edit of an entry itself does: an update in place, or a re-creation where no provider can follow, as for a move
 * to another calendar or between event and task (a CalDAV resource holds one kind, RFC 4791 §4.1).
 */
export class EntryChange {
	constructor(readonly entry: Entry, readonly edited: Entry) { }

	get recreates() {
		return this.edited.sourceId !== this.entry.sourceId || this.edited.type !== this.entry.type
	}

	/** Writes the edit, a re-created entry into `to`. Answers with the entry as it now stands. */
	async save(em: EntityManager, from: Calendar, to: Calendar): Promise<Entry> {
		const { entry, edited } = this
		if (!this.recreates) {
			await to.integration.updateEntry(em, entry, edited)
			return entry
		}
		edited.id = crypto.randomUUID()
		// Two calendars of one server share their resources' namespace, where the old uid would collide.
		edited.uid = from.source.uri && from.source.uri === to.source.uri ? crypto.randomUUID() : entry.uid
		edited.rank = edited.type.isTask ? entry.rank : undefined
		edited.migrateTo(to.source)
		// Create first, so a failure loses nothing.
		const created = await to.integration.createEntry(em, edited)
		try {
			await from.integration.deleteEntry(em, entry)
		} catch (error) {
			await to.integration.deleteEntry(em, created).catch(() => void 0)
			await em.flush().catch(() => void 0)
			throw error
		}
		return created
	}
}
