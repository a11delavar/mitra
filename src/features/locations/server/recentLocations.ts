import { type EntityManager } from '@mikro-orm/sqlite'
import { LocationSuggestion } from '../LocationSuggestion.js'

/** The four places last used in `sourceIds` whose names hold `query`, newest first: the user's own, never another user's. */
export async function recentLocations(em: EntityManager, sourceIds: ReadonlyArray<string>, query: string): Promise<Array<LocationSuggestion>> {
	if (!sourceIds.length) {
		return []
	}
	const escaped = query.replace(/[\\%_]/g, match => `\\${match}`)
	const rows = await em.getConnection().execute(
		`select location from entry where source_id in (${sourceIds.map(() => '?').join(', ')}) and location <> '' and location like '%' || ? || '%' escape '\\' group by location order by max(start) desc limit 4`,
		[...sourceIds, escaped],
	) as Array<{ location: string }>
	return rows.map(row => LocationSuggestion.recent(row.location))
}
