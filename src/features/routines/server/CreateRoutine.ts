import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { Entry } from '#features/entries'
import { updates } from '#infrastructure/realtime/Updates.js'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Routine } from '../Routine.js'

class Parameters {
	@validation(z.string())
	@description('The entry the routine starts from; for an occurrence of a repeating entry, the repeating entry\'s.')
	readonly entryId!: string
}

/** Not a tool: corrections are a person's. */
@operation(Parameters)
@label('Start a routine')
@description('Makes a routine of an entry, which later entries of its title in its calendar join by themselves. A routine once dissolved whose entries wear its title is started again rather than a second one beside it.')
@http({ method: 'POST', path: '/routines', status: 201 })
@updates('entries')
export class CreateRoutine extends Operation<Parameters, Routine> {
	async run({ em, user }: OperationContext) {
		const entry = await user.getEntry(em, this.parameters.entryId)
		const dissolved = await em.find(Routine, { sourceId: entry.sourceId, dissolved: true })
		// The dissolved routine it named, else one whose entries wear its title.
		const title = Routine.titleOf(entry.heading)
		const wearing = !title || !dissolved.length ? [] : await em.find(Entry, { sourceId: entry.sourceId, routineId: { $in: dissolved.map(routine => routine.id) } })
		const routine = dissolved.find(routine => routine.id === entry.routineId)
			?? dissolved.find(routine => wearing.some(member => member.routineId === routine.id && Routine.titleOf(member.heading) === title))
			?? new Routine({ sourceId: entry.sourceId })
		routine.restart()
		routine.adopt(entry)
		em.persist(routine)
		await em.flush()
		this.logger.debug(`Started routine ${routine.id} from entry ${entry.id}`)
		return routine
	}
}
