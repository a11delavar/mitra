import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import type { Routine } from '../Routine.js'

@operation()
@label('List dissolved routines')
@description('Lists what the person said is no routine, in the enabled calendars, each with the titles its entries wear: what the Routines tab keeps folded away to make a routine again.')
@http({ method: 'GET', path: '/routines/dissolved' })
export class ListDissolvedRoutines extends Operation<object, Array<Routine>> {
	run({ em, user }: OperationContext) {
		return user.getDissolvedRoutines(em)
	}
}
