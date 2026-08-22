import type { EntityManager } from '@mikro-orm/sqlite'
import { Entry, EntryRelation, type EntryRollup, RelationType, TaskStatus, type User } from '../shared/index.js'

// Hierarchy rollups are derived per-read from the relation store across all integrations, never persisted.

/** Complete hierarchy graph for a user, batch-resolved across all hierarchy relations. */
interface HierarchyGraph {
	/** parent uid → its direct children's uids. */
	readonly childrenByParent: ReadonlyMap<string, ReadonlyArray<string>>
	/** child uid → its direct parents' uids. */
	readonly parentsByChild: ReadonlyMap<string, ReadonlyArray<string>>
	/** Every entry the graph names, by uid — masters only, so a whole series is ONE node. */
	readonly entriesByUid: ReadonlyMap<string, Entry>
}

const EMPTY: HierarchyGraph = { childrenByParent: new Map(), parentsByChild: new Map(), entriesByUid: new Map() }

/**
 * Resolves the hierarchy graph from both PARENT and CHILD edges, deduplicated by (parent, child).
 * Only series masters are included to prevent double-counting recurrence overrides.
 */
async function hierarchyGraph(em: EntityManager, user: User): Promise<HierarchyGraph> {
	const sourceIds = (await user.sources(em)).map(source => source.id)
	if (!sourceIds.length) {
		return EMPTY
	}

	const rows = await em.find(EntryRelation, { type: { $in: [RelationType.Parent, RelationType.Child] } })
	if (!rows.length) {
		return EMPTY
	}
	const owners = await em.find(Entry, {
		id: { $in: [...new Set(rows.map(row => row.entryId))] },
		recurrenceId: null,
		sourceId: { $in: sourceIds },
	})
	const ownerById = new Map(owners.map(owner => [owner.id!, owner]))

	const seen = new Set<string>()
	const childrenByParent = new Map<string, Array<string>>()
	const parentsByChild = new Map<string, Array<string>>()
	for (const row of rows) {
		const owner = ownerById.get(row.entryId)
		const edge = owner?.uid ? row.type.hierarchyEdge(owner.uid, row.targetUid) : undefined
		if (!edge || edge.parent === edge.child || seen.has(`${edge.parent} ${edge.child}`)) {
			continue
		}
		seen.add(`${edge.parent} ${edge.child}`)
		childrenByParent.set(edge.parent, [...childrenByParent.get(edge.parent) ?? [], edge.child])
		parentsByChild.set(edge.child, [...parentsByChild.get(edge.child) ?? [], edge.parent])
	}

	// Targets may dangle if deleted, foreign, or unsynced; absent entries contribute nothing.
	const uids = [...new Set([...childrenByParent.keys(), ...parentsByChild.keys()])]
	const entries = uids.length
		? await em.find(Entry, { uid: { $in: uids }, recurrenceId: null, sourceId: { $in: sourceIds } })
		: []
	return { childrenByParent, parentsByChild, entriesByUid: new Map(entries.map(entry => [entry.uid!, entry])) }
}

/** Breadth-first walk of all descendants under `uid`, cycle-bounded via visited set and depth cap. */
function descendantUids(graph: HierarchyGraph, uid: string): Array<string> {
	const visited = new Set<string>([uid])
	const found = new Array<string>()
	let frontier: ReadonlyArray<string> = graph.childrenByParent.get(uid) ?? []
	for (let depth = 0; depth < 50 && frontier.length; depth++) {
		const next = new Array<string>()
		for (const child of frontier) {
			if (visited.has(child)) {
				continue
			}
			visited.add(child)
			found.push(child)
			next.push(...graph.childrenByParent.get(child) ?? [])
		}
		frontier = next
	}
	return found
}

/** Computes an entry's rollup, or `undefined` if it has no children (distinguishing no ring from 0%). */
function rollupOf(graph: HierarchyGraph, uid: string | undefined, cache = new Map<string, EntryRollup | undefined>(), visiting = new Set<string>()): EntryRollup | undefined {
	if (uid === undefined) {
		return undefined
	}
	if (cache.has(uid)) {
		return cache.get(uid)
	}
	if (visiting.has(uid)) {
		return undefined
	}
	visiting.add(uid)

	const childUids = graph.childrenByParent.get(uid)
	if (!childUids?.length) {
		cache.set(uid, undefined)
		return undefined
	}
	const children = childUids
		.map(child => graph.entriesByUid.get(child))
		.filter((child): child is Entry => !!child)
	if (!children.length) {
		cache.set(uid, undefined)
		return undefined
	}
	// Cancelled tasks are excluded from the denominator.
	const tasks = children.filter(child => child.type.isTask && child.status !== TaskStatus.Cancelled)
	const done = tasks.filter(child => child.status === TaskStatus.Done).length
	const progressSum = tasks.reduce((sum, child) => {
		if (child.status === TaskStatus.Done) {
			return sum + 1
		}
		const childRollup = child.uid ? rollupOf(graph, child.uid, cache, new Set(visiting)) : undefined
		if (childRollup?.total) {
			return sum + childRollup.progress
		}
		if (child.percentComplete !== null && child.percentComplete !== undefined) {
			return sum + child.percentComplete / 100
		}
		return sum
	}, 0)
	const progress = tasks.length ? progressSum / tasks.length : 0

	const result: EntryRollup = {
		done,
		total: tasks.length,
		progress,
		children: children.length,
		descendants: descendantUids(graph, uid).filter(child => graph.entriesByUid.has(child)).length,
	}
	cache.set(uid, result)
	return result
}

/**
 * Attaches {@link EntryRollup} to entries. Occurrences share their master's rollup.
 * Entries without children remain undefined.
 */
export async function attachRollups(em: EntityManager, user: User, entries: ReadonlyArray<Entry>): Promise<void> {
	if (!entries.length) {
		return
	}
	const graph = await hierarchyGraph(em, user)
	if (!graph.childrenByParent.size) {
		return
	}
	const cache = new Map<string, EntryRollup | undefined>()
	for (const entry of entries) {
		entry.subtasks = rollupOf(graph, entry.uid, cache)
	}
}

/** Direct parents (with rollups) and full subtree descendants for an entry. */
export interface EntryHierarchyView {
	parents: Array<Entry>
	descendants: Array<Entry>
}

export async function resolveHierarchyView(em: EntityManager, user: User, entry: Entry, project: (entry: Entry) => Entry): Promise<EntryHierarchyView> {
	const uid = entry.uid
	if (!uid) {
		return { parents: [], descendants: [] }
	}
	const graph = await hierarchyGraph(em, user)
	const resolve = (uids: ReadonlyArray<string>) => uids
		.map(candidate => graph.entriesByUid.get(candidate))
		.filter((found): found is Entry => !!found && found.id !== entry.id)

	const parents = resolve(graph.parentsByChild.get(uid) ?? [])
	const descendants = resolve(descendantUids(graph, uid))
	const cache = new Map<string, EntryRollup | undefined>()
	for (const found of [...parents, ...descendants]) {
		found.subtasks = rollupOf(graph, found.uid, cache)
	}
	// Ensure relations are attached so client store adoption avoids dirty diffs.
	await EntryRelation.attach(em, [...parents, ...descendants])
	return { parents: parents.map(project), descendants: descendants.map(project) }
}
