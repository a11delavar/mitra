import type { EntityManager } from '@mikro-orm/sqlite'
import { Entry, EntryRelation, EntryRelations, type Relation, RelationGraph, type User } from '../shared/index.js'

// Integration-agnostic database loading and cycle validation for relation rows. Graph algorithms live in shared/RelationGraph.ts.

/**
 * Loads the user's RelationGraph from database rows.
 * `excludeEntryId` omits existing rows for the entry being updated so cycle checks test new candidate relations.
 */
async function relationGraph(em: EntityManager, user: User, excludeEntryId?: string): Promise<RelationGraph> {
	const sourceIds = (await user.sources(em)).map(source => source.id)
	if (!sourceIds.length) {
		return RelationGraph.empty
	}
	const rows = (await em.find(EntryRelation, {})).filter(row => row.entryId !== excludeEntryId)
	if (!rows.length) {
		return RelationGraph.empty
	}
	const ownerIds = [...new Set(rows.map(row => row.entryId))]
	const targetUids = [...new Set(rows.map(row => row.targetUid))]
	const [owners, targets] = await Promise.all([
		em.find(Entry, { id: { $in: ownerIds }, recurrenceId: null, sourceId: { $in: sourceIds } }),
		em.find(Entry, { uid: { $in: targetUids }, recurrenceId: null, sourceId: { $in: sourceIds } }),
	])
	const rowsByEntry = Map.groupBy(rows, row => row.entryId)
	const entries = [...new Set([...owners, ...targets])]
	return RelationGraph.of(entries, entry => (rowsByEntry.get(entry.id!) ?? []).map(row => row.relation))
}

/** Attaches own and derived relations to entries, scoped to sources accessible by the user. */
export async function attachRelations(em: EntityManager, user: User, entries: ReadonlyArray<Entry>): Promise<void> {
	await EntryRelation.attach(em, entries, (await user.sources(em)).map(source => source.id))
}

/** Loads all entries referenced in the user's relation graph and attaches their relations. */
export async function relationClosure(em: EntityManager, user: User): Promise<Array<Entry>> {
	const entries = [...(await relationGraph(em, user)).entries]
	await attachRelations(em, user, entries)
	return entries
}

/**
 * Validates that candidate relations contain no self-references and introduce no circular hierarchy or dependency.
 * @returns an error message to 400 with, or `undefined` when valid.
 */
export async function assertRelationsValid(em: EntityManager, user: User, entry: Entry, relations: ReadonlyArray<Relation> | null): Promise<string | undefined> {
	if (!relations?.length) {
		return undefined
	}
	const entryUid = entry.uid
	if (entryUid && relations.some(relation => relation.targetUid === entryUid)) {
		return 'An entry cannot relate to itself'
	}
	if (!entryUid) {
		return undefined
	}

	// Seeds graph walk using candidate owned edges to detect cycles before persisting.
	const candidates = EntryRelations.of(entryUid, relations)
	const seedsOf = (family: 'hierarchy' | 'dependency') => candidates.lines
		.filter(line => line.direction === 'outgoing' && line.edge?.family === family && line.edge.from !== entryUid)
		.map(line => line.edge!.from)

	const graph = await relationGraph(em, user, entry.id)
	if (graph.reaches('hierarchy', seedsOf('hierarchy'), entryUid)) {
		return 'This would create a circular hierarchy'
	}
	if (graph.reaches('dependency', seedsOf('dependency'), entryUid)) {
		return 'This would create a circular dependency'
	}
	return undefined
}
