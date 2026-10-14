import type { EntityManager, FilterQuery } from '@mikro-orm/sqlite'
import { type User } from '../../identity/User.js'
import { RelationGraph } from '../RelationGraph.js'
import { EntryRelations } from '../EntryRelations.js'
import { EntryRelation } from '../EntryRelation.js'
import { Entry } from '../../entries/Entry.js'

/** `excludeEntryId` omits the updated entry's existing rows, so cycle checks test its candidate relations. */
async function relationGraph(em: EntityManager, user: User, excludeEntryId?: string): Promise<RelationGraph> {
	const sourceIds = (await user.sources(em)).map(source => source.id)
	if (!sourceIds.length) {
		return RelationGraph.empty
	}
	// The rows of the user's own entries only: another user's link to a uid they share is not the user's to see.
	const rows = (await em.find(EntryRelation, { entryId: { sourceId: { $in: sourceIds } } } as FilterQuery<EntryRelation>)).filter(row => row.entryId !== excludeEntryId)
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
	return RelationGraph.of(entries, entry => EntryRelations.of((rowsByEntry.get(entry.id!) ?? []).map(row => row.relation)))
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

/** @returns an error message to 400 with when a candidate relation points at itself or closes a cycle, else `undefined`. */
export async function assertRelationsValid(em: EntityManager, user: User, entry: Entry, relations: EntryRelations): Promise<string | undefined> {
	if (relations.isEmpty) {
		return undefined
	}
	// Availability can't be either end of a relation.
	if (entry.type.isAvailability) {
		return 'Availability cannot be related to other entries'
	}
	const sourceIds = (await user.sources(em)).map(source => source.id)
	const targets = await em.find(Entry, { uid: { $in: relations.all.map(relation => relation.targetUid) }, sourceId: { $in: sourceIds } })
	if (targets.some(target => target.type.isAvailability)) {
		return 'Availability cannot be related to other entries'
	}
	const entryUid = entry.uid
	if (entryUid && relations.all.some(relation => relation.targetUid === entryUid)) {
		return 'An entry cannot relate to itself'
	}
	if (!entryUid) {
		return undefined
	}

	// Seeds graph walk using candidate owned edges to detect cycles before persisting.
	const seedsOf = (family: 'hierarchy' | 'dependency') => relations.lines(entryUid)
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
