import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { Entry } from '#features/entries'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The calendar\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Count a calendar\'s entries')
@description('Answers how many entries a calendar holds, which deleting it would take along.')
@http({ method: 'GET', path: '/sources/:id/entries/count' })
export class CountSourceEntries extends Operation<Parameters, number> {
	async run({ em, user }: OperationContext) {
		const source = await user.source(em, this.parameters.id)
		return em.count(Entry, { sourceId: source.id })
	}
}
