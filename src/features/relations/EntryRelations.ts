import { type Converter } from '@a11d/converter'
import { Relation, type RelationDirection, type RelationInit } from './Relation.js'
import { RelationEdge } from './RelationEdge.js'
import { type RelationSection, RelationType } from './RelationType.js'

/** A stored {@link Relation} with derived presentation fields; `direction` picks its section and which entry owns the row. */
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
 * An entry's relations, owned and derived; an entry holding none (`undefined`) does not know them. Views take the
 * entry's uid when asked, as it can change after its relations arrive.
 */
export class EntryRelations {
	static readonly none = new EntryRelations([])

	/** What a request's unusable relations parse to, so `EntryPatch.validate` refuses them: never held by an entry. */
	static readonly invalid = new EntryRelations([])

	/** Normalizes items via {@link Relation.from}, drops invalid ones, dedupes by key and sorts owned before derived. */
	static of(relations: Iterable<RelationInit> = []): EntryRelations {
		const byKey = new Map<string, Relation>()
		for (const item of relations) {
			const relation = Relation.from(item)
			if (relation && !byKey.has(relation.key)) {
				byKey.set(relation.key, relation)
			}
		}
		const rank = (relation: Relation) => `${relation.isOutgoing ? 0 : 1} ${relation.type.value} ${relation.targetUid} ${relation.gap ?? ''}`
		return new EntryRelations([...byKey.values()].sort((a, b) => rank(a).localeCompare(rank(b))))
	}

	/** An array on the wire; absent stays absent, as it means unknown. */
	static readonly converter: Converter<Array<RelationInit> | null | undefined, EntryRelations | undefined> = {
		construct: value => value === undefined ? undefined : EntryRelations.of(value ?? []),
		deconstruct: relations => relations?.all as Array<RelationInit> | undefined,
	}

	/** A request's relations: `null` clears them, and only owned ones are kept, so a client echoing what it read cannot
	 * persist another entry's rows. */
	static parse(value: unknown): EntryRelations | undefined {
		if (value === undefined || value === null) {
			return value === null ? EntryRelations.none : undefined
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
		return value.every(usable) ? EntryRelations.of(value).owned : EntryRelations.invalid
	}

	private viewed?: { readonly uid: string | undefined, readonly lines: ReadonlyArray<RelationLine> }

	private constructor(readonly all: ReadonlyArray<Relation>) { }

	get isEmpty() {
		return !this.all.length
	}

	/** The owned relations, the only ones persisted to external stores. */
	get writes(): ReadonlyArray<Relation> {
		return this.all.filter(relation => relation.isOutgoing)
	}

	get owned(): EntryRelations {
		return this.writes.length === this.all.length ? this : new EntryRelations(this.writes)
	}

	equals(other: EntryRelations): boolean {
		return EntryRelations.same(this.all, other.all)
	}

	/** Whether the owned halves differ. Comparing full collections would mark entries dirty whenever
	 * reads attach derived lines. */
	writesDiffer(other: EntryRelations): boolean {
		return !EntryRelations.same(this.writes, other.writes)
	}

	private static same(a: ReadonlyArray<Relation>, b: ReadonlyArray<Relation>) {
		return a.length === b.length && a.every((relation, index) => relation.equals(b[index]))
	}

	/** The lines as the entry `selfUid` sees them: a relation authored at both ends shows once, as its own. */
	lines(selfUid: string | undefined): ReadonlyArray<RelationLine> {
		if (this.viewed && this.viewed.uid === selfUid) {
			return this.viewed.lines
		}
		const lines = new Array<RelationLine>()
		const owned = new Set<string>()
		for (const relation of this.all) {
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
		this.viewed = { uid: selfUid, lines }
		return lines
	}

	private static keyOf(line: RelationLine) {
		return line.edge?.key ?? `${line.section.value} ${line.otherUid}`
	}

	edges(selfUid: string | undefined): ReadonlyArray<RelationEdge> {
		const byKey = new Map<string, RelationEdge>()
		for (const line of this.lines(selfUid)) {
			if (line.edge && !byKey.has(line.edge.key)) {
				byKey.set(line.edge.key, line.edge)
			}
		}
		return [...byKey.values()]
	}

	/** Lines grouped by section in {@link RelationSection.rank} order, with owned lines preceding derived lines. */
	sections(selfUid: string | undefined): ReadonlyArray<{ readonly section: RelationSection, readonly lines: ReadonlyArray<RelationLine> }> {
		const bySection = new Map<RelationSection, Array<RelationLine>>()
		for (const line of this.lines(selfUid)) {
			bySection.set(line.section, [...bySection.get(line.section) ?? [], line])
		}
		return [...bySection.entries()]
			.sort(([a], [b]) => a.rank - b.rank)
			.map(([section, lines]) => ({ section, lines }))
	}

	/** With an outgoing line to `targetUid`, never to `selfUid` itself. */
	adding(type: RelationType | string, targetUid: string, selfUid?: string): EntryRelations {
		return !targetUid || targetUid === selfUid ? this : EntryRelations.of([...this.all, { type, targetUid }])
	}

	without(relation: RelationInit): EntryRelations {
		return EntryRelations.of(this.all.filter(candidate => !candidate.equals(relation)))
	}
}
