import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Entry } from '../Entry.js'
import { everyEntry, recurringEntries } from './entryWindow.js'

@operation()
@label('List all entries')
@description('Lists every entry in the visible calendars, each recurring entry once with its overrides.')
@http({ method: 'GET', path: '/entries/all' })
export class ListAllEntries extends Operation<object, Array<Entry>> {
	async run({ em, user }: OperationContext): Promise<Array<Entry>> {
		const visibleSourceIds = (await user.sources(em, { enabled: true, hidden: false })).map(source => source.id)
		const entries = [...await em.find(Entry, everyEntry(visibleSourceIds)), ...await recurringEntries(em, visibleSourceIds)]
		const graph = await user.relationGraph(em)
		graph.attach(entries)
		return entries
	}
}
