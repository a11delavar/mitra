import type { EntityManager } from '@mikro-orm/sqlite'
import { Entry, EntryRelation, Relation, RelationType, type User } from '../shared/index.js'

// --- The route-side half of the relations seam (see shared/Relation.ts, shared/EntryRelation.ts) -----
// Everything here is integration-agnostic: it reads and writes only the relation STORE and the neutral
// vocabulary — which provider an entry lives on never matters.

/** Sentinel for a request body whose `relations` field is structurally unusable (→ 400). */
export const INVALID_RELATIONS = Symbol('invalid relations')

/**
 * The tri-state `relations` off a request body: `undefined` keeps, `null` clears, an array sets
 * (normalized; an empty array is the same "none" as `null`). Bodies are PLAIN DTOs (see AGENTS.md) —
 * items are shape-checked by hand and anything structurally unusable yields {@link INVALID_RELATIONS}
 * rather than being silently dropped.
 */
export function parseIncomingRelations(value: unknown): Array<Relation> | null | undefined | typeof INVALID_RELATIONS {
	if (value === undefined || value === null) {
		return value as null | undefined
	}
	if (!Array.isArray(value)) {
		return INVALID_RELATIONS
	}
	const usable = (item: unknown): item is Partial<Relation> => {
		if (typeof item !== 'object' || item === null) {
			return false
		}
		const { type, targetUid, gap } = item as Partial<Relation>
		return typeof type === 'string' && !!type.trim()
			&& typeof targetUid === 'string' && !!targetUid.trim()
			&& (gap === null || gap === undefined || typeof gap === 'string')
	}
	return value.every(usable) ? Relation.normalize(value) : INVALID_RELATIONS
}

/**
 * Populates a DEFINITE `relations` value (array or `null`, never `undefined`) onto every entry of a
 * response — EVERY read path must do this, or the client's canonical snapshot would lack the field
 * and its dirty-tracking would see phantom differences forever. Occurrences and override rows present
 * their MASTER's relations (relationships are series-level), resolved via `recurrenceMasterId`.
 */
export async function attachRelations(em: EntityManager, entries: ReadonlyArray<Entry>): Promise<void> {
	const idOf = (entry: Entry) => entry.recurrenceMasterId ?? entry.id
	const ids = [...new Set(entries.map(idOf).filter((id): id is string => !!id))]
	const rows = ids.length ? await em.find(EntryRelation, { entryId: { $in: ids } }) : []
	const byEntry = Map.groupBy(rows, row => row.entryId)
	for (const entry of entries) {
		const id = idOf(entry)
		entry.relations = Relation.normalize((id && byEntry.get(id) || []).map(row => row.relation))
	}
}

/**
 * Validates a Mitra-authored relations write BEFORE anything is mutated: no self-reference, and no
 * directed cycle through the edited entry in either constraint family (hierarchy walks child → parent,
 * dependency walks dependent → predecessor — see shared/Relation.ts for the edge semantics). The walk
 * queries the materialized graph lazily per step (frontiers are tiny; depth-capped), scoped to the
 * user's sources, and skips the edited entry's own stored rows — the candidate list replaces them.
 *
 * Deliberately narrower than a full graph solver: it follows the CANONICAL directions Mitra authors
 * (plus STORED foreign `CHILD` lines for hierarchy; a `CHILD`-typed CANDIDATE — which the UI never
 * authors — is not walked). Foreign clients can still sync in whatever cycles they like — the local
 * mirror must reflect the server, and the future rollup/propagation features must be cycle-tolerant
 * regardless — so this guard exists to keep MITRA-authored graphs sane, not to police the
 * ecosystem. Override rows are excluded from the walk: their mirrored rows can lag the master's
 * after a Mitra-side edit (only the master's component is rewritten), and a stale edge must not
 * produce spurious rejections. @returns an error message to 400 with, or `undefined` when valid.
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
		return undefined // nothing can point back at an entry no uid identifies yet
	}

	const sourceIds = (await user.sources(em)).map(source => source.id)

	const cycleThrough = async (family: 'hierarchy' | 'dependency', seeds: ReadonlyArray<string>): Promise<boolean> => {
		const visited = new Set<string>()
		let frontier = [...new Set(seeds)]
		for (let depth = 0; depth < 50 && frontier.length; depth++) {
			if (frontier.includes(entryUid)) {
				return true
			}
			frontier.forEach(uid => visited.add(uid))
			// Out-edges AUTHORED ON the frontier entries (child→parent / dependent→predecessor) —
			// masters only: an override row shares its master's uid and may hold stale mirrored rows.
			const owners = await em.find(Entry, { uid: { $in: frontier }, recurrenceId: null, sourceId: { $in: sourceIds }, id: { $ne: entry.id } })
			const rows = owners.length ? await em.find(EntryRelation, { entryId: { $in: owners.map(owner => owner.id!) } }) : []
			const next = new Set(rows
				.filter(row => family === 'hierarchy' ? row.type === RelationType.Parent : Relation.familyOf(row.type) === 'dependency')
				.map(row => row.targetUid))
			if (family === 'hierarchy') {
				// A foreign-authored CHILD on B targeting F means F is B's child — an F→B edge child→parent.
				const reverse = await em.find(EntryRelation, { targetUid: { $in: frontier }, type: RelationType.Child, entryId: { $ne: entry.id } })
				const reverseOwners = reverse.length ? await em.find(Entry, { id: { $in: reverse.map(row => row.entryId) }, recurrenceId: null, sourceId: { $in: sourceIds } }) : []
				reverseOwners.forEach(owner => owner.uid && next.add(owner.uid))
			}
			frontier = [...next].filter(uid => !visited.has(uid))
		}
		return false
	}

	const seedsOf = (family: 'hierarchy' | 'dependency') => relations
		.filter(relation => Relation.familyOf(relation.type) === family)
		.map(relation => Relation.familyOf(relation.type) === 'hierarchy'
			? Relation.hierarchyEdge(entryUid, relation)?.parent
			: Relation.dependencyEdge(entryUid, relation)?.predecessor)
		.filter((uid): uid is string => !!uid && uid !== entryUid)

	const hierarchySeeds = seedsOf('hierarchy')
	if (hierarchySeeds.length && await cycleThrough('hierarchy', hierarchySeeds)) {
		return 'This would create a circular hierarchy'
	}
	const dependencySeeds = seedsOf('dependency')
	if (dependencySeeds.length && await cycleThrough('dependency', dependencySeeds)) {
		return 'This would create a circular dependency'
	}
	return undefined
}

/** What the editor's relations row shows for one entry, resolved for display: outgoing rows with
 * their target entries (absent = unresolvable — deleted, foreign, or not yet synced; still listed
 * and removable), and INCOMING rows — who points at this uid — with their owning entries. Both are
 * scoped to the user's sources; incoming skips override rows (relationships are series-level, the
 * master already stands in) and dedupes repeats. `project` is the viewer-zone projection the route
 * applies to every serialized entry. */
export interface EntryRelationsView {
	outgoing: Array<{ type: string, gap: string | null, targetUid: string, entry?: Entry }>
	incoming: Array<{ type: string, gap: string | null, entry: Entry }>
}

export async function resolveRelationsView(em: EntityManager, user: User, entry: Entry, project: (entry: Entry) => Entry): Promise<EntryRelationsView> {
	const sourceIds = (await user.sources(em)).map(source => source.id)

	const rows = entry.id ? await em.find(EntryRelation, { entryId: entry.id }) : []
	const targetUids = [...new Set(rows.map(row => row.targetUid))]
	const targets = targetUids.length
		? await em.find(Entry, { uid: { $in: targetUids }, recurrenceId: null, sourceId: { $in: sourceIds } })
		: []
	const targetByUid = new Map(targets.map(target => [target.uid!, target]))

	const incomingRows = entry.uid ? await em.find(EntryRelation, { targetUid: entry.uid, entryId: { $ne: entry.id ?? '' } }) : []
	const owners = incomingRows.length
		? await em.find(Entry, { id: { $in: incomingRows.map(row => row.entryId) }, recurrenceId: null, sourceId: { $in: sourceIds } })
		: []
	const ownerById = new Map(owners.map(owner => [owner.id!, owner]))

	// The embedded entries need their OWN definite relations: removing an INCOMING line edits the
	// owner's list client-side, which must therefore be known — and no serialized entry may ever
	// carry an undefined `relations` (phantom dirt, see attachRelations).
	await attachRelations(em, [...targets, ...owners])

	const outgoing = rows.map(row => {
		const target = targetByUid.get(row.targetUid)
		return { type: row.type, gap: row.gap ?? null, targetUid: row.targetUid, entry: target ? project(target) : undefined }
	})
	const seen = new Set<string>()
	const incoming: EntryRelationsView['incoming'] = []
	for (const row of incomingRows) {
		const owner = ownerById.get(row.entryId)
		const key = `${row.type} ${owner?.uid ?? row.entryId}`
		if (!owner || seen.has(key)) {
			continue
		}
		seen.add(key)
		incoming.push({ type: row.type, gap: row.gap ?? null, entry: project(owner) })
	}
	return { outgoing, incoming }
}
