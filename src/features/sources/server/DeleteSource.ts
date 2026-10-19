import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '../../../infrastructure/validation/validation.js'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { NotAllowed } from '../../../infrastructure/validation/NotAllowed.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { Entry } from '../../entries/Entry.js'
import { tool } from '../../agents/server/tool.js'

class Parameters {
	@validation(z.string())
	@description('The calendar\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Delete a calendar')
@description('Deletes a calendar with every entry in it, at its provider too where the provider allows it.')
@http({ method: 'DELETE', path: '/sources/:id' })
@tool({ name: 'delete_calendar' })
export class DeleteSource extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
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
