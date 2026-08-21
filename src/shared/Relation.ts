import { model } from './model.js'
import { converter } from '@a11d/converter'
import { RelationType } from './RelationType.js'

/** What a boundary may hand {@link Relation.normalize}: an instance, a plain wire DTO, or an
 * initializer typed with a {@link RelationType}. */
export interface RelationInit {
	type?: string | RelationType
	targetUid?: string
	gap?: string | null
}

/**
 * One outgoing relationship of an entry: `this entry —type→ targetUid`. A pure value object;
 * {@link EntryRelation} materializes these as rows, {@link RelationType} carries the vocabulary's
 * behaviour. `type` is the instance domain-side; {@link RelationType.converter} carries it across
 * the API as its plain value, and boundaries may still hand strings — normalize canonicalizes.
 *
 * Targets are entry `uid`s, never backend ids: durable across re-imports and migrations, and exactly
 * what `RELATED-TO` stores. They may DANGLE — pointers, not foreign keys.
 *
 * ONE stored direction: `PARENT` on the child, `FINISHTOSTART` on the dependent; the reverse reading
 * is derived by query, never written (a second pointer inevitably desyncs across clients). For a
 * recurring series the owner is the MASTER — occurrences present their master's relationships.
 */
@model('Relation')
export class Relation {
	@converter({ type: RelationType.converter })
	type!: RelationType
	targetUid!: string
	/** RFC 9253 `GAP` lead/lag duration, round-tripped as an opaque ISO-8601 duration string.
	 * Always `null` (never `undefined`) when absent, so serialized and constructed instances
	 * compare structurally equal. */
	gap: string | null = null

	constructor(init?: Partial<Relation>) {
		Object.assign(this, init)
	}

	/** What a structurally unusable wire value parses to — a request boundary owes the client a 400,
	 * not a throw, and `undefined` is taken (it means "absent, keep"). */
	static readonly invalid: unique symbol = Symbol('invalid relations')

	/** The tri-state `relations` field off a WIRE body: `undefined` keeps, `null` clears, an array
	 * sets ({@link normalize}d). Bodies are untrusted plain JSON — items are shape-checked, and
	 * anything unusable answers {@link invalid} rather than being silently dropped. */
	static parse(value: unknown): Array<Relation> | null | undefined | typeof Relation.invalid {
		if (value === undefined || value === null) {
			return value as null | undefined
		}
		if (!Array.isArray(value)) {
			return Relation.invalid
		}
		const usable = (item: unknown): item is Relation => {
			if (typeof item !== 'object' || item === null) {
				return false
			}
			const { type, targetUid, gap } = item as Record<'type' | 'targetUid' | 'gap', unknown>
			return typeof type === 'string' && !!type.trim()
				&& typeof targetUid === 'string' && !!targetUid.trim()
				&& (gap === null || gap === undefined || typeof gap === 'string')
		}
		return value.every(usable) ? Relation.normalize(value) : Relation.invalid
	}

	/** Canonical form of a list — trimmed UPPERCASE types, deduplicated by the full (type, target,
	 * gap) triple, sorted, `null` for "none" — so every producer yields ONE representation and value
	 * comparison never sees phantom differences. Drops structurally unusable items. */
	static normalize(relations: Iterable<RelationInit> | null | undefined): Array<Relation> | null {
		const byKey = new Map<string, Relation>()
		for (const item of relations ?? []) {
			const raw = item.type === undefined || item.type === null ? '' : String(item.type).trim()
			const targetUid = item.targetUid?.trim()
			if (!raw || !targetUid) {
				continue
			}
			const type = RelationType.of(raw)
			const gap = item.gap?.trim() || null
			const key = `${type.value} ${targetUid} ${gap ?? ''}`
			if (!byKey.has(key)) {
				byKey.set(key, new Relation({ type, targetUid, gap }))
			}
		}
		return byKey.size ? [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, relation]) => relation) : null
	}

	/** Field-wise value equality, tolerant of plain DTOs on either side. */
	static equal(a: Partial<Relation> | null | undefined, b: Partial<Relation> | null | undefined): boolean {
		return !a || !b ? !a === !b : String(a.type) === String(b.type) && a.targetUid === b.targetUid && (a.gap ?? null) === (b.gap ?? null)
	}

	/** Value equality of two lists in any representation — both are normalized first, and
	 * `null`/`undefined`/empty all mean the same "none". */
	static listEquals(a: Iterable<RelationInit> | null | undefined, b: Iterable<RelationInit> | null | undefined): boolean {
		const left = Relation.normalize(a)
		const right = Relation.normalize(b)
		return left === null || right === null ? left === right
			: left.length === right.length && left.every((relation, index) => Relation.equal(relation, right[index]))
	}
}
