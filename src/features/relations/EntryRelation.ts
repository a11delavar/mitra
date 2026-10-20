import type { EntityManager } from '@mikro-orm/core'
import { Entry } from '#features/entries'
import { Entity, entity, primaryKey, property, manyToOne, index, identity } from '#infrastructure/model'
import { Relation } from './Relation.js'
import { RelationType } from './RelationType.js'

/**
 * One row per line an entry owns, told apart by the line itself ({@link key}), so what an entry is set to saves as its rows
 * (`Entry.relations`, `@children`). Indexed by `targetUid` for reverse queries; target UIDs have no foreign key, so targets may dangle.
 */
@entity()
export class EntryRelation extends Entity {
	/** The row an owned line is stored as. */
	static of(relation: Relation) {
		return new EntryRelation({ type: relation.type, targetUid: relation.targetUid, gap: relation.gap })
	}

	@primaryKey() id: string = crypto.randomUUID()

	// Explicit @index is omitted on entryId because @manyToOne already generates one.
	@manyToOne(() => Entry, { mapToPk: true, deleteRule: 'cascade' }) entryId!: string
	@index() @property({ type: 'string' }) targetUid!: string
	@property({ type: RelationType.Mapper }) type!: RelationType
	@property({ type: 'string', nullable: true }) gap?: string | null

	constructor(init?: Partial<EntryRelation>) {
		super()
		Object.assign(this, init)
	}

	@identity()
	get key() {
		return `${this.type.value} ${this.targetUid} ${this.gap ?? ''}`
	}

	get relation(): Relation {
		return new Relation({ type: this.type, targetUid: this.targetUid, gap: this.gap ?? null })
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
}
