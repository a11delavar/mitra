import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Routine } from '../Routine.js'

@operation()
@label('List routines')
@description('Lists the routines of the enabled calendars, each with how often it comes, in days, read off its entries: what the month and year views collapse them by.')
@http({ method: 'GET', path: '/routines' })
export class ListRoutines extends Operation<object, Array<Routine>> {
	run({ em, user }: OperationContext) {
		return user.getRoutines(em)
	}
}
