import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { validation } from '../../../infrastructure/validation/validation.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { attachRelations } from '../../relations/server/relations.js'
import { Entry } from '../Entry.js'
import { entryWindow, recurringEntries } from './entryWindow.js'

class Parameters {
	@validation(z.date())
	@converter({ schema: z.iso.datetime({ offset: true }), construct: (value: string) => new Date(value) })
	readonly start!: Date

	@validation(z.date())
	@converter({ schema: z.iso.datetime({ offset: true }), construct: (value: string) => new Date(value) })
	readonly end!: Date
}

@operation(Parameters)
@label('List entries')
@description('Lists the entries of a window in the visible calendars: the one-off ones in it, the undated ones and the open tasks left behind before it, and every recurring entry once, its overrides with it.')
@http({ method: 'GET', path: '/entries' })
export class ListEntries extends Operation<Parameters, Array<Entry>> {
	async run({ em, user }: OperationContext) {
		const { start, end } = this.parameters
		const visibleSourceIds = (await user.sources(em, { enabled: true, hidden: false })).map(source => source.id)

		const rows = await em.find(Entry, entryWindow(visibleSourceIds, start, end))

		// The browser expands the recurring entries itself, each once whatever the window.
		const entries = [...rows, ...await recurringEntries(em, visibleSourceIds)]
		await attachRelations(em, user, entries)
		return entries
	}
}
