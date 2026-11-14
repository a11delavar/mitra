import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { updates } from '#infrastructure/realtime/Updates.js'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type Routine } from '../Routine.js'

class Parameters {
	@validation(z.string())
	@description('The routine\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Dissolve a routine')
@description('Says a routine is none: it leaves the list, and its entries, and those that later join it by their title, stay out of sight on the calendar.')
@http({ method: 'POST', path: '/routines/:id/dissolve' })
@updates('entries')
export class DissolveRoutine extends Operation<Parameters, Routine> {
	async run({ em, user }: OperationContext) {
		const routine = await user.getRoutine(em, this.parameters.id)
		routine.dissolve()
		await em.flush()
		return routine
	}
}
