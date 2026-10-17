import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { Entry } from '../../entries/Entry.js'

@operation()
@label('Count a calendar\'s entries')
@description('Answers how many entries a calendar holds, which deleting it would take along.')
@http({ method: 'GET', path: '/sources/:id/entries/count' })
export class CountSourceEntries extends Operation<{ readonly id: string }, number> {
	async run({ em, user }: OperationContext): Promise<number> {
		const source = await user.source(em, this.parameters.id)
		return em.count(Entry, { sourceId: source.id })
	}
}
