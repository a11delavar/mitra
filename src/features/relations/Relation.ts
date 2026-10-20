import { converter } from '@a11d/converter'
import type { Entry } from '#features/entries'
import { model } from '#infrastructure/model'
import { RelationType, type RelationSection } from './RelationType.js'
import { RelationEdge } from './RelationEdge.js'

/** Input shape accepted by {@link Relation.from} and {@link EntryRelations.of}. */
export interface RelationInit {
	type?: string | RelationType
	targetUid?: string
	gap?: string | null
	direction?: RelationDirection
	target?: Entry
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
	/**
	 * The entry at the other end, which a read links in (each entry once across it, so its JSON holds no cycle). Never
	 * written: a write sends {@link EntryRelations.writeConverter}'s lines alone.
	 */
	target?: Entry

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
			target: init.target,
		})
	}

	get isOutgoing() {
		return this.direction === 'outgoing'
	}

	/** The section the entry holding it reads it under: an incoming line reads its type from the other side. */
	get section(): RelationSection {
		return this.isOutgoing ? this.type.section : this.type.inverseSection
	}

	/** The edge it stands for, as the entry `selfUid` holds it: an incoming line is the far end's row, pointing here. */
	edgeOf(selfUid: string | undefined): RelationEdge | undefined {
		return !selfUid ? undefined : this.isOutgoing
			? RelationEdge.of(selfUid, this)
			: RelationEdge.of(this.targetUid, { type: this.type, targetUid: selfUid, gap: this.gap })
	}

	/** This line with `target` as the entry at its other end. */
	targeting(target: Entry | undefined): Relation {
		return target === this.target ? this : new Relation({ type: this.type, targetUid: this.targetUid, gap: this.gap, direction: this.direction, target })
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
