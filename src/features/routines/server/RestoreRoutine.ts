import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { updates } from '#infrastructure/realtime/Updates.js'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import type { Routine } from '../Routine.js'

class Parameters {
	@validation(z.string())
	@description('The routine\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Restore a routine')
@description('Makes a dissolved routine a routine again, with the entries it kept: it is listed again, and the views gather its entries as before.')
@http({ method: 'POST', path: '/routines/:id/restore' })
@updates('entries')
export class RestoreRoutine extends Operation<Parameters, Routine> {
	async run({ em, user }: OperationContext) {
		const routine = await user.getDissolvedRoutine(em, this.parameters.id)
		routine.restart()
		await em.flush()
		return routine
	}
}
