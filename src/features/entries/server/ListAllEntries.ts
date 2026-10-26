import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Entry } from '../Entry.js'

@operation()
@label('List all entries')
@description('Lists every entry in the visible calendars, each recurring entry once with its overrides.')
@http({ method: 'GET', path: '/entries/all' })
export class ListAllEntries extends Operation<object, Array<Entry>> {
	run({ em, user }: OperationContext) {
		return user.filterEntries(em, { sources: { enabled: true, hidden: false } })
	}
}
