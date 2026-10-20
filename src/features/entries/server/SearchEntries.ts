import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { attachRelations } from '#features/relations/server/relations.js'
import { tool } from '#features/agents/server/tool.js'
import { Integration } from '#integrations'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Entry } from '../Entry.js'
import { entrySearch, withOverrides } from './entryWindow.js'

class Parameters {
	@validation(z.string())
	@description('Words to look for.')
	readonly query!: string
}

@operation(Parameters)
@label('Search entries')
@description('Finds entries whose title, description or location contains the words, at most 20, hidden calendars included. A repeating entry is found once.')
@http({ method: 'GET', path: '/entries/search' })
@tool({ name: 'search_entries' })
export class SearchEntries extends Operation<Parameters, Array<Entry>> {
	async run({ em, user }: OperationContext) {
		const query = this.parameters.query.trim()
		if (!query) {
			return []
		}

		// Hidden calendars too: hiding one is a view preference, and the browser dims what it finds there.
		const sources = await user.sources(em, { enabled: true })

		const integrations = new Map((await em.find(Integration, { id: { $in: sources.map(source => source.integrationId) } })).map(integration => [integration.id, integration]))
		const integrationOf = new Map(sources.map(source => [source.id, integrations.get(source.integrationId)]))
		const found = await em.find(Entry, entrySearch(sources.map(source => source.id), query), { orderBy: { start: 'desc' }, limit: 20 })
		// The events written for availability are background too, like availability itself.
		const entries = found.filter(entry => !integrationOf.get(entry.sourceId)?.writtenForAvailability(entry))
		// The browser picks each recurring entry's occurrence, past the dates its overrides take.
		await withOverrides(em, entries.filter(entry => entry.recurrence))
		await attachRelations(em, user, entries)
		return entries
	}
}
