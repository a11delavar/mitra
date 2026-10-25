import { type EntityManager } from '@mikro-orm/core'
import type { Source } from '#features/sources'
import { type Entry } from './Entry.js'

/**
 * What an edit of an entry itself does: an update in place, or a re-creation where no provider can follow, as for a move
 * to another calendar or between event and task (a CalDAV resource holds one kind, RFC 4791 §4.1). A provider that moves
 * entries between its own calendars (`entries.move`) keeps them in place, with what Mitra does not show.
 */
export class EntryChange {
	constructor(readonly entry: Entry, readonly edited: Entry) { }

	recreates(from: Source, to: Source) {
		const moved = this.edited.sourceId !== this.entry.sourceId
		const movesInPlace = from.integrationId === to.integrationId && to.integration.capabilities.entries.move
		return this.edited.type !== this.entry.type || (moved && !movesInPlace)
	}

	/** Writes the edit, a re-created entry into `to`. Answers with the entry as it now stands. */
	async save(em: EntityManager, from: Source, to: Source): Promise<Entry> {
		const { entry, edited } = this
		if (!this.recreates(from, to)) {
			await to.integration.updateEntry(em, entry, edited)
			return entry
		}
		// A copy, so its files are rows of their own before the provider is written: its ATTACH lines name their ids, and the old rows go with `entry`.
		const recreated = Object.assign(edited.copy(), {
			id: crypto.randomUUID(),
			// Two calendars of one server share their resources' namespace, where the old uid would collide.
			uid: from.uri && from.uri === to.uri ? crypto.randomUUID() : entry.uid,
			rank: edited.type.isTask ? entry.rank : undefined,
			relations: edited.relations,
		})
		recreated.migrateTo(to)
		// Create first, so a failure loses nothing.
		const created = await to.integration.createEntry(em, recreated)
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
