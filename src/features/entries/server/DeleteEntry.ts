import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { validation } from '../../../infrastructure/validation/validation.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { tool } from '../../agents/server/tool.js'

class Parameters {
	@validation(z.string())
	@description('The entry\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Delete an entry')
@description('Deletes an entry, a repeating entry with every occurrence. Occurrences are deleted on their own, with how far the deletion reaches.')
@http({ method: 'DELETE', path: '/entries/:id' })
@tool({ name: 'delete_entry' })
export class DeleteEntry extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const entry = await user.entry(em, this.parameters.id)
		const { source, integration } = await user.calendar(em, entry.sourceId)
		if (!integration.capabilitiesFor(source).entries.delete) {
			throw new ValidationError('Entries in this calendar cannot be deleted from mitra')
		}
		await integration.deleteEntry(em, entry)
		await em.flush()
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Deleted entry ${entry.id} "${entry.heading}"`)
	}
}
