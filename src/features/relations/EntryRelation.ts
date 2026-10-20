import type { EntityManager } from '@mikro-orm/core'
import { Entry } from '#features/entries'
import { entity, primaryKey, property, manyToOne, index } from '#infrastructure/model'
import { EntryRelations } from './EntryRelations.js'
import { Relation } from './Relation.js'
import { RelationType } from './RelationType.js'

/** One row per outgoing relationship, indexed by `targetUid` for reverse queries. Target UIDs have no foreign key, so targets may dangle. */
@entity()
export class EntryRelation {
	@primaryKey() id: string = crypto.randomUUID()

	// Explicit @index is omitted on entryId because @manyToOne already generates one.
	@manyToOne(() => Entry, { mapToPk: true, deleteRule: 'cascade' }) entryId!: string
	@index() @property({ type: 'string' }) targetUid!: string
	@property({ type: RelationType.Mapper }) type!: RelationType
	@property({ type: 'string', nullable: true }) gap?: string | null

	constructor(init?: Partial<EntryRelation>) {
		Object.assign(this, init)
	}

	get relation(): Relation {
		return new Relation({ type: this.type, targetUid: this.targetUid, gap: this.gap ?? null })
	}

	/** Loads outgoing relations directly from rows for write-path diffing. A read attaches both directions through the user's `RelationGraph`. */
	static async loadFor(em: EntityManager, entries: ReadonlyArray<Entry>): Promise<void> {
		const ids = entries.map(entry => entry.id).filter((id): id is string => !!id)
		const rows = ids.length ? await em.find(EntryRelation, { entryId: { $in: ids } }) : []
		const byEntry = Map.groupBy(rows, row => row.entryId)
		for (const entry of entries) {
			entry.relations = EntryRelations.of((byEntry.get(entry.id!) ?? []).map(row => row.relation))
		}
	}

	/**
	 * Points the rows of entries in `sourceIds` (only those of `entryIds`, when given) from the old UIDs of entries that
	 * moved to their new ones. Never another user's: a calendar two users share gives both the very same UIDs.
	 */
	static async repoint(em: EntityManager, uids: ReadonlyMap<string, string>, sourceIds: ReadonlyArray<string>, entryIds?: ReadonlyArray<string>): Promise<void> {
		const rows = uids.size ? await em.find(EntryRelation, { targetUid: { $in: [...uids.keys()] }, ...entryIds ? { entryId: { $in: [...entryIds] } } : {} }) : []
		const ownerIds = [...new Set(rows.map(row => row.entryId))]
		const owned = new Set(ownerIds.length ? (await em.find(Entry, { id: { $in: ownerIds }, sourceId: { $in: [...sourceIds] } })).map(entry => entry.id) : [])
		for (const row of rows.filter(row => owned.has(row.entryId))) {
			row.targetUid = uids.get(row.targetUid)!
		}
	}

	/** Synchronizes an entry's relation rows with desired relations without committing the transaction. */
	static async reconcile(em: EntityManager, entryId: string, relations: EntryRelations): Promise<void> {
		EntryRelation.applyDiff(em, entryId, relations.writes, await em.find(EntryRelation, { entryId }))
	}

	/** Batched {@link reconcile} across multiple entries for sync paths. */
	static async reconcileAll(em: EntityManager, relationsByEntryId: ReadonlyMap<string, EntryRelations>): Promise<void> {
		if (!relationsByEntryId.size) {
			return
		}
		const rows = await em.find(EntryRelation, { entryId: { $in: [...relationsByEntryId.keys()] } })
		const byEntry = Map.groupBy(rows, row => row.entryId)
		for (const [entryId, relations] of relationsByEntryId) {
			EntryRelation.applyDiff(em, entryId, relations.writes, byEntry.get(entryId) ?? [])
		}
	}

	// Named to avoid conflicts with Function.prototype.apply in entity decorators.
	private static applyDiff(em: EntityManager, entryId: string, desired: ReadonlyArray<Relation>, rows: ReadonlyArray<EntryRelation>): void {
		// Compares canonical relation keys. Reconcile receives only owned lines to protect foreign rows.
		const key = (relation: Relation) => relation.key
		const existingKeys = new Set(rows.map(row => key(row.relation)))
		const desiredKeys = new Set(desired.map(key))
		for (const row of rows) {
			if (!desiredKeys.has(key(row.relation))) {
				em.remove(row)
			}
		}
		for (const relation of desired) {
			if (!existingKeys.has(key(relation))) {
				em.persist(new EntryRelation({ entryId, type: relation.type, targetUid: relation.targetUid, gap: relation.gap ?? null }))
			}
		}
	}
}
