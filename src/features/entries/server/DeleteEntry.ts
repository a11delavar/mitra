import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type EntryOccurrenceChangeScope } from '../../recurrence/EntryOccurrenceChange.js'

@operation()
@label('Delete an entry')
@description('Deletes an entry, a repeating entry with every occurrence, or with a scope and an occurrence only that one or the ones from it on.')
@http({ method: 'DELETE', path: '/entries/:id' })
export class DeleteEntry extends Operation<{ readonly id: string, readonly scope?: EntryOccurrenceChangeScope, readonly recurrenceId?: Date }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const { id, scope, recurrenceId } = this.parameters
		const entry = await user.entry(em, id)
		const { source, integration } = await user.calendar(em, entry.sourceId)

		if (!integration.capabilitiesFor(source).entries.delete) {
			throw new ValidationError('Entries in this calendar cannot be deleted from mitra')
		}

		if (scope && scope !== 'all' && recurrenceId) {
			await entry.occurrences.at(recurrenceId).delete(scope).save(em, integration)
			await em.flush()
			syncEmitter.emit('updated', user.id)
			this.logger.debug(`Deleted occurrence of series ${entry.id} (scope '${scope}')`)
			return
		}

		await integration.deleteEntry(em, entry)
		await em.flush()
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Deleted entry ${entry.id} "${entry.heading}"`)
	}
}
