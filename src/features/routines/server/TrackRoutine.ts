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

	@validation(z.boolean())
	@description('Whether it is kept up, so its streak and how it goes are read; false for a schedule, such as a bill or a meeting.')
	readonly tracked!: boolean
}

@operation(Parameters)
@label('Track a routine')
@description('Reads a routine\'s streak and how it goes, or stops for one that is only a schedule.')
@http({ method: 'PUT', path: '/routines/:id/tracked' })
@updates('entries')
export class TrackRoutine extends Operation<Parameters, Routine> {
	async run({ em, user }: OperationContext) {
		const routine = await user.getRoutine(em, this.parameters.id)
		this.parameters.tracked ? routine.track() : routine.untrack()
		await em.flush()
		return routine
	}
}
