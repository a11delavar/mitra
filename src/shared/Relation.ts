import { model } from './model.js'
import { converter } from '@a11d/converter'
import { RelationType } from './RelationType.js'

/** Input shape accepted by {@link Relation.from} and {@link EntryRelations.of}. */
export interface RelationInit {
	type?: string | RelationType
	targetUid?: string
	gap?: string | null
	direction?: RelationDirection
}

/** Ownership direction: outgoing persists with the entry; incoming is derived at read time. */
export type RelationDirection = 'outgoing' | 'incoming'

/**
 * Perspectival relationship line as read by one entry. `outgoing` indicates the entry owns the row;
 * `incoming` indicates the target entry owns it. Targets are entry UIDs and may dangle.
 * Collection-level logic (parsing, diffing, write-filtering) lives on {@link EntryRelations}.
 */
@model('Relation')
export class Relation {
	@converter({ type: RelationType.converter })
	type!: RelationType
	targetUid!: string
	/** RFC 9253 GAP lead/lag duration string. Always null when absent so serialized and constructed instances match. */
	gap: string | null = null
	/** Direction perspective. Temporal types lack reverse RFC equivalents, so reverse readings are
	 * modeled as incoming lines of the same relation type rather than distinct inverted types. */
	direction: RelationDirection = 'outgoing'

	constructor(init?: Partial<Relation>) {
		Object.assign(this, init)
	}

	/** Factory normalizing raw inputs into canonical Relation instances. Returns undefined if invalid. */
	static from(init: RelationInit): Relation | undefined {
		const raw = init.type === undefined || init.type === null ? '' : String(init.type).trim()
		const targetUid = init.targetUid?.trim()
		return !raw || !targetUid ? undefined : new Relation({
			type: RelationType.of(raw),
			targetUid,
			gap: init.gap?.trim() || null,
			direction: init.direction ?? 'outgoing',
		})
	}

	get isOutgoing() {
		return this.direction === 'outgoing'
	}

	/** Canonical key identifying the line within an entry's relation bag. */
	get key(): string {
		return `${this.direction} ${this.type.value} ${this.targetUid} ${this.gap ?? ''}`
	}

	equals(other: RelationInit | null | undefined): boolean {
		const coerced = other && Relation.from(other)
		return !!coerced && coerced.key === this.key
	}
}
