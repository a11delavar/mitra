import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import type { Entry } from '#features/entries'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.date())
	@description('From when on the entries of their own are listed; a repeating entry comes whole, its overrides from then on.')
	@converter({ schema: z.iso.datetime({ offset: true }), construct: (value: string) => new Date(value) })
	readonly since!: Date
}

@operation(Parameters)
@label('List routine entries')
@description('Lists the entries of the routines in the enabled calendars as stored, each repeating one with its overrides inside it: what the Routines tab reads their dates off, as the views read theirs.')
@http({ method: 'GET', path: '/routines/entries' })
export class ListRoutineEntries extends Operation<Parameters, Array<Entry>> {
	async run({ em, user }: OperationContext) {
		return user.getRoutineEntries(em, await user.getRoutines(em), { since: this.parameters.since })
	}
}
