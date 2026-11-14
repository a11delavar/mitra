import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { Entry } from '#features/entries'
import { updates } from '#infrastructure/realtime/Updates.js'
import { validation, ValidationError } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type Routine } from '../Routine.js'

class Parameters {
	@validation(z.string())
	@description('The routine that goes.')
	readonly id!: string

	@validation(z.string())
	@description('The routine of the same calendar that takes its entries.')
	readonly into!: string
}

@operation(Parameters)
@label('Merge routines')
@description('Moves a routine\'s entries into another routine of its calendar, for one habit that went by two titles, and removes the first. Later entries wearing either title join the one left.')
@http({ method: 'POST', path: '/routines/:id/merge' })
@updates('entries')
export class MergeRoutines extends Operation<Parameters, Routine> {
	async run({ em, user }: OperationContext) {
		const routine = await user.getRoutine(em, this.parameters.id)
		const into = await user.getRoutine(em, this.parameters.into)
		if (into === routine) {
			throw new ValidationError('A routine cannot be merged into itself', ['into'])
		}
		if (into.sourceId !== routine.sourceId) {
			throw new ValidationError('Only routines of one calendar can be merged', ['into'])
		}
		const moving = await em.find(Entry, { routineId: routine.id })
		for (const entry of moving) {
			entry.routineId = into.id
		}
		em.remove(routine)
		await em.flush()
		this.logger.debug(`Merged routine ${routine.id} into ${into.id}, ${moving.length} entries`)
		return into
	}
}
