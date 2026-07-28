/** The sidebar's manual order, written wholesale (see the `order` columns on Source/Integration):
 * the listed ids take their position, and every OTHER row drops back to null — "append at the end
 * when it next appears". Never write incremental swaps: a wholesale pass is what keeps stale
 * numbers on rows that have since left the visible list (disabled sources) from interleaving with
 * a later hand-made order. Shared by the two reorder routes and the client's optimistic re-sort. */
export function applyOrder(rows: Array<{ id: string, order?: number | null }>, ids: ReadonlyArray<string>): void {
	const position = new Map(ids.map((id, index) => [id, index]))
	for (const row of rows) {
		row.order = position.get(row.id) ?? null
	}
}

/** The display comparator the server sorts by (`order asc nulls last`) — for re-sorting the
 * client's local store without a refetch. Stable sorts keep insertion order among the nulls,
 * mirroring SQLite's row order for the unnumbered rest. */
export function byOrder(a: { order?: number | null }, b: { order?: number | null }): number {
	return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
}
