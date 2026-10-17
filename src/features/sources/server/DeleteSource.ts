import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { NotAllowed } from '../../../infrastructure/validation/NotAllowed.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { Entry } from '../../entries/Entry.js'

@operation()
@label('Delete a calendar')
@description('Deletes a calendar with its entries, at its provider too where the provider allows it.')
@http({ method: 'DELETE', path: '/sources/:id' })
export class DeleteSource extends Operation<{ readonly id: string }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const { source, integration } = await user.calendar(em, this.parameters.id)
		if (!integration.capabilitiesFor(source).sources.delete) {
			throw new NotAllowed('This calendar cannot be deleted from mitra')
		}

		const entries = await em.count(Entry, { sourceId: source.id })
		await integration.deleteSource(em, source)
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.info(`Deleted source "${source.name}" (${source.id}) and its ${entries} entr${entries === 1 ? 'y' : 'ies'}`)
	}
}
