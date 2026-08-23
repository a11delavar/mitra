import { Relation, type RelationDirection, type RelationInit } from './Relation.js'
import { RelationEdge } from './RelationEdge.js'
import { type RelationSection, RelationType } from './RelationType.js'

/**
 * Stored {@link Relation} decorated with derived presentation and routing fields.
 * `direction` determines the rendered {@link RelationSection} and which entry owns row persistence.
 */
export interface RelationLine {
	readonly relation: Relation
	readonly direction: RelationDirection
	readonly type: RelationType
	readonly section: RelationSection
	readonly otherUid: string
	readonly ownerUid?: string
	readonly edge?: RelationEdge
}

/**
 * Per-entry collection of owned and derived relation lines, handling grouping, deduplication, and
 * write-filtering. Cross-entry questions (descendants, rollups, cycles) belong to {@link RelationGraph}.
 */
export class EntryRelations {
	static readonly empty = new EntryRelations(undefined, [])

	/** Structurally unusable wire value: parsed at request boundaries to return 400 without throwing. */
	static readonly invalid: unique symbol = Symbol('invalid relations')

	/** Normalizes items via {@link Relation.from}, drops invalid entries, dedupes by key, and sorts
	 * owned lines before derived echoes so duplicates are cleanly silenced. */
	static of(selfUid: string | undefined, relations: Iterable<RelationInit> | null | undefined): EntryRelations {
		const byKey = new Map<string, Relation>()
		for (const item of relations ?? []) {
			const relation = Relation.from(item)
			if (relation && !byKey.has(relation.key)) {
				byKey.set(relation.key, relation)
			}
		}
		const rank = (relation: Relation) => `${relation.isOutgoing ? 0 : 1} ${relation.type.value} ${relation.targetUid} ${relation.gap ?? ''}`
		const lines = new Array<RelationLine>()
		const owned = new Set<string>()
		for (const relation of [...byKey.values()].sort((a, b) => rank(a).localeCompare(rank(b)))) {
			const type = relation.type
			const outgoing = relation.isOutgoing
			const line: RelationLine = {
				relation,
				direction: relation.direction,
				type,
				section: outgoing ? type.section : type.inverseSection,
				otherUid: relation.targetUid,
				ownerUid: outgoing ? undefined : relation.targetUid,
				// Incoming lines represent the same edge from the far end: target is owner, pointing to self.
				edge: !selfUid ? undefined : outgoing
					? RelationEdge.of(selfUid, relation)
					: RelationEdge.of(relation.targetUid, { type, targetUid: selfUid, gap: relation.gap }),
			}
			if (outgoing) {
				owned.add(EntryRelations.keyOf(line))
				lines.push(line)
				continue
			}
			// Redundantly authored reverse relationships (e.g. PARENT and CHILD both stored) are silenced
			// in favor of the owned line so removals edit the locally owned pointer.
			if (!owned.has(EntryRelations.keyOf(line))) {
				lines.push(line)
			}
		}
		return new EntryRelations(selfUid, lines)
	}

	private static keyOf(line: RelationLine) {
		return line.edge?.key ?? `${line.section.value} ${line.otherUid}`
	}

	private constructor(private readonly selfUid: string | undefined, readonly lines: ReadonlyArray<RelationLine>) { }

	/** Parses a wire value into owned lines to persist. Derived lines are filtered out so clients
	 * echoing read responses cannot persist foreign relation rows. */
	static parse(value: unknown): Array<Relation> | null | undefined | typeof EntryRelations.invalid {
		if (value === undefined || value === null) {
			return value as null | undefined
		}
		if (!Array.isArray(value)) {
			return EntryRelations.invalid
		}
		const usable = (item: unknown): item is RelationInit => {
			if (typeof item !== 'object' || item === null) {
				return false
			}
			const { type, targetUid, gap, direction } = item as Record<'type' | 'targetUid' | 'gap' | 'direction', unknown>
			const namesAType = type instanceof RelationType || (typeof type === 'string' && !!type.trim())
			return namesAType
				&& typeof targetUid === 'string' && !!targetUid.trim()
				&& (gap === null || gap === undefined || typeof gap === 'string')
				// Absent direction defaults to outgoing for backwards compatibility.
				&& (direction === undefined || direction === 'outgoing' || direction === 'incoming')
		}
		return value.every(usable) ? EntryRelations.of(undefined, value).writes : EntryRelations.invalid
	}

	/** Canonical stored form of all lines, or `null` if empty. */
	get value(): Array<Relation> | null {
		return this.lines.length ? this.lines.map(line => line.relation) : null
	}

	/** The owned subset of lines in canonical stored form; the only part persisted to external stores. */
	get writes(): Array<Relation> | null {
		const owned = this.lines.filter(line => line.direction === 'outgoing').map(line => line.relation)
		return owned.length ? owned : null
	}

	equals(other: EntryRelations): boolean {
		return EntryRelations.same(this.value, other.value)
	}

	/** Whether the owned halves differ. Comparing full collections would mark entries dirty whenever
	 * reads attach derived lines. */
	writesDiffer(other: EntryRelations): boolean {
		return !EntryRelations.same(this.writes, other.writes)
	}

	private static same(a: Array<Relation> | null, b: Array<Relation> | null) {
		return a === null || b === null ? a === b : a.length === b.length && a.every((relation, index) => relation.equals(b[index]))
	}

	get edges(): ReadonlyArray<RelationEdge> {
		const byKey = new Map<string, RelationEdge>()
		for (const line of this.lines) {
			if (line.edge && !byKey.has(line.edge.key)) {
				byKey.set(line.edge.key, line.edge)
			}
		}
		return [...byKey.values()]
	}

	/** Lines grouped by section in {@link RelationSection.rank} order, with owned lines preceding derived lines. */
	get sections(): ReadonlyArray<{ readonly section: RelationSection, readonly lines: ReadonlyArray<RelationLine> }> {
		const bySection = new Map<RelationSection, Array<RelationLine>>()
		for (const line of this.lines) {
			bySection.set(line.section, [...bySection.get(line.section) ?? [], line])
		}
		return [...bySection.entries()]
			.sort(([a], [b]) => a.rank - b.rank)
			.map(([section, lines]) => ({ section, lines }))
	}

	ownerUidOf(line: RelationLine) {
		return line.ownerUid
	}

	/** Returns a new collection with the outgoing line added and normalized. */
	adding(type: RelationType | string, targetUid: string): EntryRelations {
		return !targetUid || targetUid === this.selfUid
			? this
			: EntryRelations.of(this.selfUid, [...this.value ?? [], { type, targetUid }])
	}

	without(relation: RelationInit): EntryRelations {
		return EntryRelations.of(this.selfUid, (this.value ?? []).filter(candidate => !candidate.equals(relation)))
	}
}
