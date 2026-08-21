import { entity, primaryKey, property, manyToOne, index } from './orm.js'
import { Entry } from './Entry.js'
import { Relation } from './Relation.js'
import { RelationType } from './RelationType.js'
import type { EntityManager } from '@mikro-orm/core'

/**
 * The queryable materialization of {@link Entry.relations} — one row per outgoing relationship,
 * kept in lockstep via {@link attach} on every read path and {@link reconcile} on every write and sync. It exists for the questions
 * the entry's own list cannot answer without a full scan: the REVERSE direction ("who points at
 * this uid?" — the indexed `targetUid`), powering incoming links today, shift-propagation and
 * status-rollup tomorrow.
 *
 * WHO is authoritative differs per integration (the tri-state seam): a native link store (CalDAV's
 * `RELATED-TO`) parses a DEFINITE `entry.relations` on sync and these rows mirror it; an integration
 * without one leaves the field `undefined` and the table IS the store. Route writes reconcile in the
 * same flush as the entry; the external write happens before, so a failed one changes nothing
 * locally, and a failed flush is healed by the next sync re-parsing the resource.
 *
 * `targetUid` is deliberately NOT a foreign key — targets may dangle. Deleting an entry cascades
 * its own rows; rows pointing AT it stay, dangling by design.
 */
@entity()
export class EntryRelation {
	@primaryKey() id: string = crypto.randomUUID()

	// No explicit @index on entryId: the manyToOne FK already generates one (an explicit twin would
	// duplicate its name and make the boot-time schema update throw on every start after the first).
	@manyToOne(() => Entry, { mapToPk: true, deleteRule: 'cascade' }) entryId!: string
	@index() @property({ type: 'string' }) targetUid!: string
	@property({ type: RelationType.Mapper }) type!: RelationType
	@property({ type: 'string', nullable: true }) gap?: string | null

	constructor(init?: Partial<EntryRelation>) {
		Object.assign(this, init)
	}

	/** This row as the value object it materializes. */
	get relation(): Relation {
		return new Relation({ type: this.type, targetUid: this.targetUid, gap: this.gap ?? null })
	}

	/** Populates each entry's OWN `relations` from its rows (one batched query), normalizing
	 * "no rows" to `null`. This is the row-keyed read for write paths (an update's diff needs the
	 * stored value); display paths that must present a master's relations on its occurrences
	 * resolve the master id themselves before calling. */
	static async loadFor(em: EntityManager, entries: ReadonlyArray<Entry>): Promise<void> {
		const ids = entries.map(entry => entry.id).filter((id): id is string => !!id)
		const rows = ids.length ? await em.find(EntryRelation, { entryId: { $in: ids } }) : []
		const byEntry = Map.groupBy(rows, row => row.entryId)
		for (const entry of entries) {
			entry.relations = Relation.normalize((byEntry.get(entry.id!) ?? []).map(row => row.relation))
		}
	}

	/** Populates a DEFINITE `relations` value (array or `null`, never `undefined`) onto every entry
	 * of a response — EVERY read path must, or the client's canonical snapshot would lack the field
	 * and see phantom dirt forever. Occurrences present their MASTER's relations. */
	static async attach(em: EntityManager, entries: ReadonlyArray<Entry>): Promise<void> {
		const idOf = (entry: Entry) => entry.recurrenceMasterId ?? entry.id
		const ids = [...new Set(entries.map(idOf).filter((id): id is string => !!id))]
		const rows = ids.length ? await em.find(EntryRelation, { entryId: { $in: ids } }) : []
		const byEntry = Map.groupBy(rows, row => row.entryId)
		for (const entry of entries) {
			const id = idOf(entry)
			entry.relations = Relation.normalize((id && byEntry.get(id) || []).map(row => row.relation))
		}
	}


	/** Diffs one entry's rows against the desired list (`null` = none) — removes stale rows,
	 * persists missing ones, leaves matches untouched. Does NOT flush: the caller owns the
	 * transaction, so the mirror commits atomically with the entry's other changes. */
	static async reconcile(em: EntityManager, entryId: string, relations: ReadonlyArray<Relation> | null): Promise<void> {
		EntryRelation.applyDiff(em, entryId, relations, await em.find(EntryRelation, { entryId }))
	}

	/** {@link reconcile} for many entries with ONE batched row query — the sync path. */
	static async reconcileAll(em: EntityManager, relationsByEntryId: ReadonlyMap<string, ReadonlyArray<Relation> | null>): Promise<void> {
		if (!relationsByEntryId.size) {
			return
		}
		const rows = await em.find(EntryRelation, { entryId: { $in: [...relationsByEntryId.keys()] } })
		const byEntry = Map.groupBy(rows, row => row.entryId)
		for (const [entryId, relations] of relationsByEntryId) {
			EntryRelation.applyDiff(em, entryId, relations, byEntry.get(entryId) ?? [])
		}
	}

	// Named to dodge `Function.apply`: a private static called `apply` makes the class structurally
	// incompatible with `Function`, which breaks the entity decorator's typing.
	private static applyDiff(em: EntityManager, entryId: string, relations: ReadonlyArray<Relation> | null, rows: ReadonlyArray<EntryRelation>): void {
		const key = (relation: Pick<Relation, 'type' | 'targetUid' | 'gap'>) => `${relation.type} ${relation.targetUid} ${relation.gap ?? ''}`
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
