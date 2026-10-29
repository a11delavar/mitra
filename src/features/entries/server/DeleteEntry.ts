import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { tool } from '#features/agents/server/tool.js'
import { validation, ValidationError } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

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
@updates('entries')
export class DeleteEntry extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const entry = await user.getEntry(em, this.parameters.id)
		if (!entry.deletable) {
			throw new ValidationError('Entries in this calendar cannot be deleted from mitra')
		}
		await entry.source.integration.deleteEntry(em, entry)
		await em.flush()
		this.logger.debug(`Deleted entry ${entry.id} "${entry.heading}"`)
	}
}
