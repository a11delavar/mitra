import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { Entry } from '#features/entries'
import { updates } from '#infrastructure/realtime/Updates.js'
import { validation, ValidationError } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The entry\'s id; for an occurrence of a repeating entry, the repeating entry\'s, whose routine they share.')
	readonly id!: string

	@validation(z.string().nullable())
	@description('The routine of its calendar to put it in, or null to take it out of every routine for good.')
	readonly routineId!: string | null
}

/** Not a tool: corrections are a person's. */
@operation(Parameters)
@label('Choose an entry\'s routine')
@description('Puts an entry into a routine of its calendar, as the person chose, or with none out of every routine for good, so recognition passes it over though its title still matches.')
@http({ method: 'PUT', path: '/entries/:id/routine' })
@updates('entries')
export class ChooseEntryRoutine extends Operation<Parameters, Entry> {
	async run({ em, user }: OperationContext) {
		const { id, routineId } = this.parameters
		const entry = await user.getEntry(em, id)
		const routine = routineId === null ? undefined : await user.getRoutine(em, routineId)
		if (routine && routine.sourceId !== entry.sourceId) {
			throw new ValidationError('An entry joins only a routine of its own calendar', ['routineId'])
		}
		// A recurring entry's overrides are its dates, and go where it goes.
		const overrides = entry.recurrence?.freq ? await em.find(Entry, { recurringEntryId: entry.id }) : []
		for (const each of [entry, ...overrides]) {
			if (routine) {
				routine.adopt(each)
			} else {
				each.declineRoutines()
			}
		}
		await em.flush()
		this.logger.debug(routine ? `Put entry ${entry.id} into routine ${routine.id}` : `Took entry ${entry.id} out of every routine`)
		return entry
	}
}
