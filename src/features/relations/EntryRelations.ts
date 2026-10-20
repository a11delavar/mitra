import { type Converter } from '@a11d/converter'
import { z } from 'zod'
import type { Entry } from '#features/entries'
import { type Validatable, ValidationError } from '#infrastructure/validation'
import { Relation, type RelationInit } from './Relation.js'
import { type RelationEdge } from './RelationEdge.js'
import type { RelationGraph } from './RelationGraph.js'
import { type RelationSection, RelationType } from './RelationType.js'

/** What a candidate list is judged against: the entry to hold it, and the graph of the user's relations. */
export interface EntryRelationsContext {
	readonly entry: Entry
	readonly graph: RelationGraph
}

/**
 * An entry's relations, owned and derived, each holding the entry at its other end where a read linked it; an entry
 * holding none (`undefined`) does not know them. Views take the entry's uid when asked, as it can change after its
 * relations arrive.
 */
export class EntryRelations implements Validatable<EntryRelationsContext> {
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

	/** An array on the wire, the entries at the other ends inside it; absent stays absent, as it means unknown. */
	static readonly converter: Converter<Array<RelationInit> | null | undefined, EntryRelations | undefined> = {
		construct: value => value === undefined ? undefined : EntryRelations.of(value ?? []),
		deconstruct: relations => relations?.all as Array<RelationInit> | undefined,
	}

	/** What a write sends and reads: the owned lines alone, without the entries a read linked into them. */
	static readonly writeConverter: Converter<Array<RelationInit> | null | undefined, EntryRelations | undefined> = {
		// Types stay open, as an unknown one must round-trip; a line echoed with `direction: 'incoming'` is another entry's and dropped.
		schema: z.array(z.object({ type: z.string(), targetUid: z.string(), gap: z.string().nullish(), direction: z.enum(['outgoing', 'incoming']).optional() })),
		construct: value => EntryRelations.parse(value),
		deconstruct: relations => relations?.writes.map(relation => relation.targeting(undefined)),
	}

	/**
	 * Links into the relations of `entries` the entries at their other ends, and on from those, however far: each entry
	 * once, inside the line that first reaches it, and none of `entries` themselves, so a read carries its graph without a
	 * cycle. Lines to an entry already placed name it by uid alone.
	 */
	static link(entries: ReadonlyArray<Entry>, entryOf: (uid: string) => Entry | undefined, placed: ReadonlySet<string | undefined> = new Set(entries.map(entry => entry.uid))): void {
		const reaching = entries.flatMap(entry => entry.relations?.all ?? []).filter(relation => !placed.has(relation.targetUid))
		// Reversed, so the first line reaching an entry is the one the map keeps.
		const holders = new Map(reaching.toReversed().map(relation => [relation.targetUid, relation]))
		const targets = new Map([...holders.keys()].map(uid => [uid, entryOf(uid)] as const).filter((pair): pair is readonly [string, Entry] => !!pair[1]))
		entries.forEach(entry => entry.relations = entry.relations?.targeting(relation => holders.get(relation.targetUid) === relation ? targets.get(relation.targetUid) : undefined))
		if (targets.size) {
			EntryRelations.link([...targets.values()], entryOf, new Set([...placed, ...targets.keys()]))
		}
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

	private viewed?: { readonly uid: string | undefined, readonly shown: ReadonlyArray<Relation> }

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

	/** The relations as the entry `selfUid` shows them: one authored at both ends shows once, as its own. */
	shown(selfUid: string | undefined): ReadonlyArray<Relation> {
		if (this.viewed && this.viewed.uid === selfUid) {
			return this.viewed.shown
		}
		const keyOf = (relation: Relation) => relation.edgeOf(selfUid)?.key ?? `${relation.section.value} ${relation.targetUid}`
		const owned = new Set(this.writes.map(keyOf))
		// Redundantly authored reverse relationships (e.g. PARENT and CHILD both stored) are silenced in favor of the owned
		// one, so a removal edits the locally owned pointer.
		const shown = this.all.filter(relation => relation.isOutgoing || !owned.has(keyOf(relation)))
		this.viewed = { uid: selfUid, shown }
		return shown
	}

	edges(selfUid: string | undefined): ReadonlyArray<RelationEdge> {
		const byKey = new Map<string, RelationEdge>()
		for (const relation of this.shown(selfUid)) {
			const edge = relation.edgeOf(selfUid)
			if (edge && !byKey.has(edge.key)) {
				byKey.set(edge.key, edge)
			}
		}
		return [...byKey.values()]
	}

	/** The shown relations grouped by section in {@link RelationSection.rank} order, owned ones preceding derived ones. */
	sections(selfUid: string | undefined): ReadonlyArray<{ readonly section: RelationSection, readonly relations: ReadonlyArray<Relation> }> {
		const bySection = Map.groupBy(this.shown(selfUid), relation => relation.section)
		return [...bySection.entries()]
			.sort(([a], [b]) => a.rank - b.rank)
			.map(([section, relations]) => ({ section, relations }))
	}

	/** What keeps `entry` from holding these lines: availability at either end, a line to itself, or a loop closed in a family, judged on the graph as the write would leave it. */
	*validate({ entry, graph }: EntryRelationsContext) {
		if (this.isEmpty) {
			return
		}
		if (entry.type.isAvailability || this.all.some(relation => graph.entryOf(relation.targetUid)?.type.isAvailability)) {
			yield new ValidationError('Availability cannot be related to other entries', ['relations'])
		}
		const uid = entry.uid
		if (!uid) {
			return
		}
		if (this.all.some(relation => relation.targetUid === uid)) {
			yield new ValidationError('An entry cannot relate to itself', ['relations'])
		}
		// Walks up from the far ends of the candidate lines: reaching the entry again closes a loop.
		const replaced = graph.replacing(entry, this)
		const seedsOf = (family: 'hierarchy' | 'dependency') => this.writes
			.map(relation => relation.edgeOf(uid))
			.filter(edge => edge?.family === family && edge.from !== uid)
			.map(edge => edge!.from)
		if (replaced.reaches('hierarchy', seedsOf('hierarchy'), uid)) {
			yield new ValidationError('This would create a circular hierarchy', ['relations'])
		}
		if (replaced.reaches('dependency', seedsOf('dependency'), uid)) {
			yield new ValidationError('This would create a circular dependency', ['relations'])
		}
	}

	/** These relations with the entry `targetOf` names as each one's other end. */
	targeting(targetOf: (relation: Relation) => Entry | undefined): EntryRelations {
		return new EntryRelations(this.all.map(relation => relation.targeting(targetOf(relation))))
	}

	/** With an outgoing line to `targetUid`, never to `selfUid` itself. */
	adding(type: RelationType | string, targetUid: string, selfUid?: string): EntryRelations {
		return !targetUid || targetUid === selfUid ? this : EntryRelations.of([...this.all, { type, targetUid }])
	}

	without(relation: RelationInit): EntryRelations {
		return EntryRelations.of(this.all.filter(candidate => !candidate.equals(relation)))
	}
}
