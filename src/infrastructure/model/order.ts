/** Apply index order from `ids` to items, setting unlisted items to null. */
export function applyOrder(rows: Array<{ id: string, order?: number | null }>, ids: ReadonlyArray<string>): void {
	const position = new Map(ids.map((id, index) => [id, index]))
	for (const row of rows) {
		row.order = position.get(row.id) ?? null
	}
}

/** Display comparator sorting numbered items first, then nulls last. */
export function byOrder(a: { order?: number | null }, b: { order?: number | null }): number {
	return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
}
