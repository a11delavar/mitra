import { type EntityManager } from '@mikro-orm/sqlite'
import type { User } from '#features/identity'
import { LocationSuggestion } from '../LocationSuggestion.js'

/** The four places last used in the user's calendars whose names hold `query`, newest first: the user's own, never another user's. */
export async function recentLocations(em: EntityManager, user: User, query: string): Promise<Array<LocationSuggestion>> {
	const escaped = query.replace(/[\\%_]/g, match => `\\${match}`)
	const rows = await em.getConnection().execute(
		`select location from entry join source on source.id = entry.source_id join integration on integration.id = source.integration_id where integration.user_id = ? and location <> '' and location like '%' || ? || '%' escape '\\' group by location order by max(start) desc limit 4`,
		[user.id, escaped],
	) as Array<{ location: string }>
	return rows.map(row => LocationSuggestion.recent(row.location))
}
