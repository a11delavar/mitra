import { entity, primaryKey, property, manyToOne, index } from './orm.js'
import { Entry } from './Entry.js'
import { Relation } from './Relation.js'
import type { EntityManager } from '@mikro-orm/core'

/**
 * The queryable materialization of {@link Entry.relations} — one row per outgoing relationship,
 * kept in lockstep with the entry (via {@link reconcile} on every write path and sync). The row
 * store exists for the questions the entry's own list cannot answer without a full scan: the
 * REVERSE direction ("who points at this uid?" — the indexed `targetUid`), which powers incoming
 * links today and shift-propagation/status-rollup tomorrow.
 *
 * **Who is authoritative differs per integration, and the tri-state seam decides it**: an
 * integration whose native format stores links (CalDAV's `RELATED-TO`) parses them into a DEFINITE
 * `entry.relations` value (array or `null`) on sync, and reconciliation mirrors that truth here.
 * An integration with no native link store (Dev; any future one that opts out) leaves
 * `entry.relations` `undefined` on sync, and reconciliation leaves these rows alone — the table
 * itself is then the sole store. Route writes reconcile in the same `em.flush()` transaction as
 * the entry, so the local mirror is atomic; the external write (e.g. the CalDAV PUT) necessarily
 * happens before and outside it, ordered so a failed external write changes nothing locally and a
 * failed flush is healed by the next sync re-parsing the resource.
 *
 * `targetUid` is deliberately NOT a foreign key: targets may not exist locally (deleted, hidden
 * source, not yet synced) — see {@link Relation}. Deleting an entry cascades its own rows; rows
 * elsewhere pointing AT it go dangling by design.
 */
@entity()
export class EntryRelation {
	@primaryKey() id: string = crypto.randomUUID()

	// No explicit @index on entryId: the manyToOne FK already generates one (an explicit twin would
	// duplicate its name and make the boot-time schema update throw on every start after the first).
	@manyToOne(() => Entry, { mapToPk: true, deleteRule: 'cascade' }) entryId!: string
	@index() @property({ type: 'string' }) targetUid!: string
	@property({ type: 'string' }) type!: string
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
