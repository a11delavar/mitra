import { model } from './model.js'

/**
 * Mitra's relationship vocabulary — UPPERCASE strings borrowed from the iCalendar RELTYPE registry
 * (RFC 5545 §3.2.15 hierarchy, RFC 9253 §5 temporal dependencies), used as the app-wide,
 * integration-NEUTRAL lingua franca: the domain model, the API and the relation store all speak
 * these values, and every integration maps its own native link format to and from them at its own
 * edge (CalDAV: `RELATED-TO;RELTYPE=…` properties; a future Notion integration: its relation
 * properties; GitHub Projects: blocked-by links; the local Dev calendar: nothing — the relation
 * table itself is its native store). The registry vocabulary is deliberately kept rather than
 * inventing a parallel one: it already covers hierarchy + all four project-management dependencies,
 * and using it verbatim makes the first (CalDAV) mapping the identity function.
 */
export const RelationType = {
	/** This entry is a child of the target — the canonical form of hierarchy (see below). */
	Parent: 'PARENT',
	/** The target is a child of this entry. Foreign clients author this; Mitra never does. */
	Child: 'CHILD',
	/** This entry and the target share a parent. Derivable, so Mitra never authors it. */
	Sibling: 'SIBLING',
	/** This entry cannot start until the target finishes — the canonical dependency (see below). */
	FinishToStart: 'FINISHTOSTART',
	/** This entry cannot finish until the target finishes. */
	FinishToFinish: 'FINISHTOFINISH',
	/** This entry cannot start until the target starts. */
	StartToStart: 'STARTTOSTART',
	/** This entry cannot finish until the target starts. */
	StartToFinish: 'STARTTOFINISH',
} as const
export type RelationType = typeof RelationType[keyof typeof RelationType]

/**
 * The relation types the editor OFFERS when authoring, in UI order: "Blocked by" (dependency,
 * the default) and "Subtask of" (hierarchy). Everything else — SIBLING, the exotic temporal
 * variants, `X-` extensions, unknown foreign values — still round-trips losslessly
 * ({@link Relation.type} is an open string) and renders read-only; offering another type later
 * is extending this list plus its labels.
 */
export const AUTHORABLE_RELATION_TYPES: ReadonlyArray<string> = [RelationType.FinishToStart, RelationType.Parent]

/**
 * One outgoing relationship of an entry: `this entry —type→ targetUid`. A pure value object —
 * no persistence, no integration knowledge; {@link EntryRelation} materializes these as queryable
 * rows and integrations serialize them natively.
 *
 * **Targets are entry `uid`s** (never backend `id`s): the uid is the durable cross-source,
 * cross-deployment identifier — it survives a re-import and a cross-source migration, and it is
 * exactly what iCalendar `RELATED-TO` stores, so foreign-authored links resolve with no mapping.
 * A target may be dangling (deleted, in a hidden source, not yet synced) — relationships are
 * pointers, not foreign keys, and consumers must render an unresolvable target gracefully.
 *
 * **One stored direction (canonical authoring rule):** Mitra authors hierarchy as `PARENT` on the
 * CHILD (targeting its parent) and dependency as `FINISHTOSTART` on the DEPENDENT (targeting its
 * predecessor). The reverse reading ("has subtask", "blocks") is *derived* by querying the
 * relation store — never written as a second pointer, which would inevitably desync the two sides
 * across third-party clients. Foreign-authored directions (e.g. a `CHILD` some other client wrote)
 * are preserved verbatim and interpreted via {@link Relation.hierarchyEdge}/{@link Relation.dependencyEdge}.
 *
 * **Series:** relationships belong to an entry, and for a recurring series that entry is the
 * MASTER — occurrences and overrides present their master's relationships.
 */
@model('Relation')
export class Relation {
	type!: string
	targetUid!: string
	/** RFC 9253 `GAP` lead/lag duration, round-tripped as an opaque ISO-8601 duration string.
	 * Always `null` (never `undefined`) when absent, so serialized and constructed instances
	 * compare structurally equal. */
	gap: string | null = null

	constructor(init?: Partial<Relation>) {
		Object.assign(this, init)
	}

	/** Canonical form of a list: trimmed, UPPERCASE types, deduplicated by the FULL value triple
	 * (type, target, gap — a lead/lag difference is a distinct relationship, and the identity must
	 * match the row store's and the .ics differ's), sorted — and `null` for "none" (like
	 * `Entry.reminders`), so every producer yields ONE representation and value comparison can
	 * never see phantom differences from ordering or an empty array. Tolerant of plain wire DTOs;
	 * drops structurally unusable items (no type or no target). */
	static normalize(relations: Iterable<Partial<Relation>> | null | undefined): Array<Relation> | null {
		const byKey = new Map<string, Relation>()
		for (const item of relations ?? []) {
			const type = item.type?.trim().toUpperCase()
			const targetUid = item.targetUid?.trim()
			if (!type || !targetUid) {
				continue
			}
			const gap = item.gap?.trim() || null
			const key = `${type} ${targetUid} ${gap ?? ''}`
			if (!byKey.has(key)) {
				byKey.set(key, new Relation({ type, targetUid, gap }))
			}
		}
		return byKey.size ? [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, relation]) => relation) : null
	}

	/** Field-wise value equality, tolerant of plain DTOs on either side. */
	static equal(a: Partial<Relation> | null | undefined, b: Partial<Relation> | null | undefined): boolean {
		return !a || !b ? !a === !b : a.type === b.type && a.targetUid === b.targetUid && (a.gap ?? null) === (b.gap ?? null)
	}

	/** Value equality of two lists in any representation — both are normalized first, and
	 * `null`/`undefined`/empty all mean the same "none". */
	static listEquals(a: Iterable<Partial<Relation>> | null | undefined, b: Iterable<Partial<Relation>> | null | undefined): boolean {
		const left = Relation.normalize(a)
		const right = Relation.normalize(b)
		return left === null || right === null ? left === right
			: left.length === right.length && left.every((relation, index) => Relation.equal(relation, right[index]))
	}

	/** Which constraint family a type belongs to — hierarchy and dependency form SEPARATE graphs
	 * (a task may be both a subtask of A and depend on A); `undefined` for types Mitra doesn't
	 * interpret (SIBLING, `X-`…), which constrain nothing. */
	static familyOf(type: string): 'hierarchy' | 'dependency' | undefined {
		switch (type) {
			case RelationType.Parent:
			case RelationType.Child:
				return 'hierarchy'
			case RelationType.FinishToStart:
			case RelationType.FinishToFinish:
			case RelationType.StartToStart:
			case RelationType.StartToFinish:
				return 'dependency'
			default:
				return undefined
		}
	}

	/** The hierarchy edge a stored relation means, whichever direction it was authored in:
	 * `PARENT` on A targeting B reads "B is A's parent"; a foreign `CHILD` on A targeting B reads
	 * "B is A's child". `undefined` when the relation carries no hierarchy semantics. */
	static hierarchyEdge(ownerUid: string, relation: Pick<Relation, 'type' | 'targetUid'>): { parent: string, child: string } | undefined {
		switch (relation.type) {
			case RelationType.Parent:
				return { parent: relation.targetUid, child: ownerUid }
			case RelationType.Child:
				return { parent: ownerUid, child: relation.targetUid }
			default:
				return undefined
		}
	}

	/** The dependency edge a stored relation means: all four temporal types sit on the DEPENDENT
	 * and target what it waits for (RFC 9253's authoring direction), differing only in which
	 * boundaries they couple. `undefined` for non-temporal types. */
	static dependencyEdge(ownerUid: string, relation: Pick<Relation, 'type' | 'targetUid'>): { dependent: string, predecessor: string } | undefined {
		return Relation.familyOf(relation.type) === 'dependency' ? { dependent: ownerUid, predecessor: relation.targetUid } : undefined
	}
}
