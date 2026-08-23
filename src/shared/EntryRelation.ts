import { entity, primaryKey, property, manyToOne, index } from './orm.js'
import { Entry } from './Entry.js'
import { EntryRelations } from './EntryRelations.js'
import { Relation } from './Relation.js'
import { RelationType } from './RelationType.js'
import type { EntityManager } from '@mikro-orm/core'

/**
 * Queryable persistence entity for {@link Entry.relations} (one row per outgoing relationship).
 * Indexed by `targetUid` to enable reverse relation queries without full table scans.
 * Target UIDs deliberately omit foreign key constraints so targets may dangle.
 */
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

	/** Loads outgoing relations directly from rows for write-path diffing. Display paths should use {@link attach}. */
	static async loadFor(em: EntityManager, entries: ReadonlyArray<Entry>): Promise<void> {
		const ids = entries.map(entry => entry.id).filter((id): id is string => !!id)
		const rows = ids.length ? await em.find(EntryRelation, { entryId: { $in: ids } }) : []
		const byEntry = Map.groupBy(rows, row => row.entryId)
		for (const entry of entries) {
			entry.relations = EntryRelations.of(entry.uid, (byEntry.get(entry.id!) ?? []).map(row => row.relation)).value
		}
	}

	/** Attaches own and incoming (derived) relations to entries scoped to viewer-accessible sources.
	 * Occurrences inherit relations from their recurrence master. */
	static async attach(em: EntityManager, entries: ReadonlyArray<Entry>, sourceIds: ReadonlyArray<string>): Promise<void> {
		const idOf = (entry: Entry) => entry.recurrenceMasterId ?? entry.id
		const ids = [...new Set(entries.map(idOf).filter((id): id is string => !!id))]
		const uids = [...new Set(entries.map(entry => entry.uid).filter((uid): uid is string => !!uid))]
		const [rows, pointing] = await Promise.all([
			ids.length ? em.find(EntryRelation, { entryId: { $in: ids } }) : [],
			uids.length && sourceIds.length ? em.find(EntryRelation, { targetUid: { $in: uids } }) : [],
		])
		const ownerIds = [...new Set(pointing.map(row => row.entryId))]
		const owners = ownerIds.length ? await em.find(Entry, { id: { $in: ownerIds }, recurrenceId: null, sourceId: { $in: sourceIds } }) : []
		const ownerUidById = new Map(owners.filter(owner => !!owner.uid).map(owner => [owner.id!, owner.uid!]))

		const byEntry = Map.groupBy(rows, row => row.entryId)
		const byTarget = Map.groupBy(pointing, row => row.targetUid)
		for (const entry of entries) {
			const id = idOf(entry)
			const own = (id && byEntry.get(id) || []).map(row => row.relation)
			const derived = (entry.uid && byTarget.get(entry.uid) || [])
				.filter(row => row.entryId !== id && ownerUidById.has(row.entryId))
				.map(row => new Relation({ type: row.type, targetUid: ownerUidById.get(row.entryId)!, gap: row.gap ?? null, direction: 'incoming' }))
			entry.relations = EntryRelations.of(entry.uid, [...own, ...derived]).value
		}
	}

	/** Synchronizes an entry's relation rows with desired relations without committing the transaction. */
	static async reconcile(em: EntityManager, entryId: string, relations: ReadonlyArray<Relation> | null): Promise<void> {
		EntryRelation.applyDiff(em, entryId, EntryRelations.of(undefined, relations).writes, await em.find(EntryRelation, { entryId }))
	}

	/** Batched {@link reconcile} across multiple entries for sync paths. */
	static async reconcileAll(em: EntityManager, relationsByEntryId: ReadonlyMap<string, ReadonlyArray<Relation> | null>): Promise<void> {
		if (!relationsByEntryId.size) {
			return
		}
		const rows = await em.find(EntryRelation, { entryId: { $in: [...relationsByEntryId.keys()] } })
		const byEntry = Map.groupBy(rows, row => row.entryId)
		for (const [entryId, relations] of relationsByEntryId) {
			EntryRelation.applyDiff(em, entryId, EntryRelations.of(undefined, relations).writes, byEntry.get(entryId) ?? [])
		}
	}

	// Named to avoid conflicts with Function.prototype.apply in entity decorators.
	private static applyDiff(em: EntityManager, entryId: string, relations: ReadonlyArray<Relation> | null, rows: ReadonlyArray<EntryRelation>): void {
		// Compares canonical relation keys. Reconcile receives only owned lines to protect foreign rows.
		const key = (relation: Relation) => relation.key
		const desired = relations ?? []
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
