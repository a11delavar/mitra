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

	@validation(z.string().nullable())
	@description('The person\'s name for it; none, or a blank one, names it after its entries again.')
	readonly name!: string | null
}

@operation(Parameters)
@label('Rename a routine')
@description('Gives a routine a name of the person\'s own, which its entries keep their titles beside.')
@http({ method: 'PUT', path: '/routines/:id/name' })
@updates('entries')
export class RenameRoutine extends Operation<Parameters, Routine> {
	async run({ em, user }: OperationContext) {
		const routine = await user.getRoutine(em, this.parameters.id)
		routine.rename(this.parameters.name)
		await em.flush()
		return routine
	}
}
