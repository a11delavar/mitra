import { equals } from '@a11d/equals'
import { type EntityManager } from '@mikro-orm/core'
import type { RelationGraph } from '#features/relations'
import { OrganizerOnly } from '#features/participants/OrganizerOnly.js'
import type { EntryOccurrenceChangeScope } from '#features/recurrence'
import type { Validatable } from '#infrastructure/validation'
import { type Entry } from './Entry.js'
import { type EntryPatch } from './EntryPatch.js'

export interface EntryChangeContext {
	readonly graph?: RelationGraph
	readonly scope?: EntryOccurrenceChangeScope
}

/**
 * What a write of an entry does: a creation (`source.create`, without an `entry`), an update in place, or a re-creation
 * where no provider can follow, as for a move to another calendar or between event and task (a CalDAV resource holds one
 * kind, RFC 4791 §4.1). A provider that moves entries between its own calendars (`entries.move`) keeps them in place,
 * with what Mitra does not show.
 */
export class EntryChange implements Validatable<EntryChangeContext> {
	constructor(readonly entry: Entry | undefined, readonly edited: Entry, readonly patch: EntryPatch) { }

	/** The calendar the entry is in, or for a creation the one it goes to. */
	get from() {
		return (this.entry ?? this.edited).source
	}

	/** The calendar the edit leaves it in, which whoever makes the change sets once it is proved the user's (`user.source`). */
	get to() {
		return this.edited.source
	}

	/** Whether it is written as a new entry rather than in place. */
	get recreates() {
		const moved = this.edited.sourceId !== this.entry?.sourceId
		const movesInPlace = this.from.integrationId === this.to.integrationId && this.to.integration.capabilities.entries.move
		return this.edited.type !== this.entry?.type || (moved && !movesInPlace)
	}

	/** The entries the relations' check reads around, by uid: this one's, and those its candidate lines name. */
	get related() {
		return [(this.entry ?? this.edited).uid, ...this.patch.relations?.all.map(relation => relation.targetUid) ?? []]
	}

	/**
	 * What refuses the change, judged before any provider is written, as a refusal must leave it untouched: who may change
	 * the participants, what the patch may do here and in `scope`, what the calendar can hold, and where the relations would
	 * lead, on the `graph` `user.getRelationGraph(em, change.related)` gives where the patch carries them.
	 */
	*validate({ graph, scope }: EntryChangeContext = {}) {
		const { entry, edited, patch } = this
		// Changing the list is the organizer's prerogative, so content edits pass only while they leave it as it is.
		if (entry && !Object[equals](edited.participants, entry.participants) && !entry.canManageParticipants) {
			yield new OrganizerOnly('Only the organizer can modify participants', ['participants'])
		}
		yield* patch.validate({ entry, from: this.from, to: this.to, scope })
		yield* edited.validate()
		if (patch.relations !== undefined && graph) {
			yield* patch.relations.validate({ entry: entry ?? edited, graph })
		}
	}

	/** Writes the edit, fitted to its calendar, a new or re-created entry into the calendar it goes to. Answers with the entry as it now stands. */
	async save(em: EntityManager): Promise<Entry> {
		const { entry, edited, from, to } = this
		edited.fit()
		if (!entry) {
			return to.integration.createEntry(em, edited)
		}
		if (!this.recreates) {
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
