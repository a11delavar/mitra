import { description, label } from '@a11d/metadata'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { attachRelations } from '../../relations/server/relations.js'
import { Entry } from '../Entry.js'
import { entryWindow, recurringEntries } from './entryWindow.js'

@operation()
@label('List entries')
@description('Lists the entries of a window in the visible calendars: the one-off ones in it, the undated ones and the open tasks left behind before it, and every recurring entry once, its overrides with it.')
@http({ method: 'GET', path: '/entries' })
export class ListEntries extends Operation<{ readonly start?: Date, readonly end?: Date }, Array<Entry>> {
	async run({ em, user }: OperationContext): Promise<Array<Entry>> {
		const { start, end } = this.parameters
		if (!start || !end) {
			throw new ValidationError('Missing start or end date parameters', ['start', 'end'])
		}

		const visibleSources = await user.sources(em, { enabled: true, hidden: false })
		const visibleSourceIds = visibleSources.map(source => source.id)

		const rows = await em.find(Entry, entryWindow(visibleSourceIds, start, end))

		// The browser expands the recurring entries itself, each once whatever the window.
		const entries = [...rows, ...await recurringEntries(em, visibleSourceIds)]
		await attachRelations(em, user, entries)
		return entries
	}
}
