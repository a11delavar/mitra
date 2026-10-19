import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { validation } from '../../../infrastructure/validation/validation.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
import { EntryOccurrenceChangeScope } from '../../recurrence/EntryOccurrenceChange.js'
import { tool } from '../../agents/server/tool.js'

class Parameters {
	@validation(z.string())
	@description('The repeating entry\'s id.')
	readonly id!: string

	@validation(z.date())
	@description('The occurrence\'s id: its original start, as the overview names it.')
	@converter(EntryOccurrence.idConverter)
	readonly occurrence!: Date

	@validation(z.enum(EntryOccurrenceChangeScope))
	@description('Which occurrences the deletion reaches: this one, this one and every later one, or all of them.')
	readonly scope!: EntryOccurrenceChangeScope
}

@operation(Parameters)
@label('Delete occurrences')
@description('Deletes one occurrence of a repeating entry, and with its scope the ones after it too, or all of them.')
@http({ method: 'DELETE', path: '/entries/:id/occurrences/:occurrence' })
@tool({ name: 'delete_entry_occurrence' })
export class DeleteEntryOccurrence extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const { scope } = this.parameters
		const entry = await user.entry(em, this.parameters.id)
		const { source, integration } = await user.calendar(em, entry.sourceId)
		if (!integration.capabilitiesFor(source).entries.delete) {
			throw new ValidationError('Entries in this calendar cannot be deleted from mitra')
		}
		const occurrence = entry.occurrences.existing(this.parameters.occurrence)
		if (scope === EntryOccurrenceChangeScope.All) {
			await integration.deleteEntry(em, entry)
		} else {
			await occurrence.delete(scope).save(em, integration)
		}
		await em.flush()
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Deleted occurrence of series ${entry.id} (scope '${scope}')`)
	}
}
