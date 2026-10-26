import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { tool } from '#features/agents/server/tool.js'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Entry } from '../Entry.js'

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
		// The browser picks each recurring entry's occurrence, past the dates its overrides take.
		const found = await user.filterEntries(em, { search: query, sources: { enabled: true }, limit: 20 })
		// The events written for availability are background too, like availability itself.
		return found.filter(entry => !entry.source.integration.writtenForAvailability(entry))
	}
}
